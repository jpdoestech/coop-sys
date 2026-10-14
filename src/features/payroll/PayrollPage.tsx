import { useDeferredValue, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, CalendarSearch, Copy, Info, Plus, RefreshCw, Search, SlidersHorizontal } from "lucide-react";
import { useAccess } from "../../services/access/useAccess";
import { createPayrollRepository } from "../../services/repositories/payrollRepositoryFactory";
import { assertPayrollAccess } from "../../services/payroll/payrollAccess";
import { formatPesos } from "../../services/payments/paymentMath";
import { salaryAmount } from "../../services/payroll/payrollSetup";
import type { PayrollKind, PayrollRecord } from "../../types/payroll";
import { useWorkspacePath } from "../../components/layout/WorkspaceNavigation";
import { PaginationControls } from "../../components/ui/PaginationControls";
import { ToolbarDisclosure } from "../../components/ui/ToolbarDisclosure";
import { LoadingProgress } from "../../components/ui/LoadingProgress";
import { useConfirmation, useConfirmLeave } from "../../components/forms/unsavedChanges";
import { PayrollRecordForm } from "./PayrollRecordForm";
import { payrollLabels } from "./payrollLabels";
import { PayrollDatePreview } from "./PayrollDatePreview";
import { AttendancePanel } from "./AttendancePanel";
import { PayrollRunsPage } from "./PayrollRunsPage";

export function PayrollPage() {
  const { profile, can } = useAccess();
  const repository = useMemo(() => createPayrollRepository(profile), [profile]);
  const client = useQueryClient(), confirm = useConfirmation();
  const leave = useConfirmLeave();
  const [attendanceOpen, setAttendanceOpen] = useState(false);
  const [runsOpen, setRunsOpen] = useState(false);
  const [kind, setKind] = useState<PayrollKind>("worksite"), [search, setSearch] = useState("");
  const [page, setPage] = useState(1), [size, setSize] = useState(25), [archived, setArchived] = useState(false);
  const [editing, setEditing] = useState<{ source?: PayrollRecord } | null>(null), [preview, setPreview] = useState(false);
  const deferred = useDeferredValue(search);
  let accessError = ""; try { assertPayrollAccess(profile); } catch (error) { accessError = (error as Error).message; }
  const query = useQuery({ queryKey: ["payroll-setup", profile.userId, kind, deferred, archived, page, size], queryFn: () => repository.list({ kind, search: deferred, includeArchived: archived, limit: size, offset: (page - 1) * size }), enabled: !accessError && !attendanceOpen && !runsOpen });
  const refresh = async () => { await client.invalidateQueries({ queryKey: ["payroll-setup"] }); await client.invalidateQueries({ queryKey: ["payroll-work-date"] }); await client.invalidateQueries({ queryKey: ["payroll-lookup"] }); };
  const archive = useMutation({ mutationFn: (id: string) => repository.archive(id), onSuccess: refresh });
  function tab(next: PayrollKind) { leave(() => { setAttendanceOpen(false); setRunsOpen(false); setKind(next); setSearch(""); setPage(1); setArchived(false); }); }
  useWorkspacePath([{ label: "Payroll", onSelect: () => tab("worksite") }, { label: runsOpen ? "Payroll Runs" : attendanceOpen ? "Attendance" : payrollLabels[kind] }]);
  const headings = ["Name", ...(kind === "worksite" ? ["Region", "Locality", "Wage category", "Wage series"] : kind === "wage" ? ["Region / category", "Order / tranche", "Daily minimum", "Review"] : kind === "cooperative_policy" ? ["Default per cutoff"] : kind === "deduction" ? ["Employee", "Type", "Amount policy", "Per cutoff", "Opening balance"] : ["Employee / worksite", "Pay basis", "Base rate / salary", "Shift", "Rest days"]), ...(kind !== "worksite" ? ["Effective from", "Effective until"] : []), "Reason", "Actions"];
  return <section className="overflow-hidden border border-line bg-white" aria-label="Payroll setup workspace">
    <nav aria-label="Payroll views" className="flex items-center overflow-x-auto border-b border-line px-2"><button type="button" aria-current={runsOpen ? "page" : undefined} className={`h-10 shrink-0 border-b-2 px-3 text-xs font-semibold ${runsOpen ? "border-moss text-moss" : "border-transparent text-ink/55"}`} onClick={() => leave(() => { setRunsOpen(true); setAttendanceOpen(false); })}>Payroll Runs</button><button type="button" aria-current={attendanceOpen ? "page" : undefined} className={`h-10 shrink-0 border-b-2 px-3 text-xs font-semibold ${attendanceOpen ? "border-moss text-moss" : "border-transparent text-ink/55"}`} onClick={() => leave(() => { setRunsOpen(false); setAttendanceOpen(true); })}>Attendance</button>{(Object.keys(payrollLabels) as PayrollKind[]).map((item) => <button key={item} type="button" aria-current={!attendanceOpen && !runsOpen && kind === item ? "page" : undefined} className={`h-10 shrink-0 border-b-2 px-3 text-xs font-semibold ${!attendanceOpen && !runsOpen && kind === item ? "border-moss text-moss" : "border-transparent text-ink/55"}`} onClick={() => tab(item)}>{payrollLabels[item]}</button>)}<div className="ml-auto pl-2"><ToolbarDisclosure label="Payroll setup notice" icon={Info}><p className="text-xs text-ink/65">Setup and work-date previews only. Attendance is available separately. Payroll run preparation is available. Ordinary-day draft estimates are available. Final salary calculation, statutory deductions, and payslips are not yet available. Salary access requires organization-wide payroll permissions.</p></ToolbarDisclosure></div></nav>
    {runsOpen ? accessError ? <p role="alert" className="p-3 text-xs text-red-700">{accessError}</p> : <PayrollRunsPage payroll={repository} /> : attendanceOpen ? <AttendancePanel payroll={repository} /> : <>
    <div className="data-toolbar"><label className="relative min-w-[160px] flex-1 sm:max-w-72"><Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/40" /><input className="compact-control w-full pl-8" aria-label="Search payroll setup" placeholder="Search record name" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /></label>
      <ToolbarDisclosure label="Payroll setup filters" icon={SlidersHorizontal} count={Number(archived)}><label className="filter-toggle"><input type="checkbox" checked={archived} onChange={(e) => { setArchived(e.target.checked); setPage(1); }} />Include archived versions</label></ToolbarDisclosure>
      <span className="text-[11px] text-ink/45">{query.data?.total || 0} records</span><div className="toolbar-actions"><button type="button" className="icon-button" title="Refresh payroll setup" aria-label="Refresh payroll setup" disabled={query.isFetching || Boolean(accessError)} onClick={() => void refresh()}><RefreshCw className="h-4 w-4" /></button><button type="button" className="secondary-button" disabled={Boolean(accessError)} onClick={() => setPreview(true)}><CalendarSearch className="h-4 w-4" />Work-date preview</button>{can("payroll.manage") && !accessError ? <button type="button" className="primary-button" onClick={() => setEditing({})}><Plus className="h-4 w-4" />New record</button> : null}</div>
    </div>
    {accessError || query.isError || archive.isError ? <p role="alert" className="border-b border-line bg-red-50 px-3 py-2 text-xs text-red-700">{accessError || query.error?.message || archive.error?.message}</p> : null}
    <div className="max-h-[65vh] overflow-auto" aria-busy={query.isFetching}><table className="w-full min-w-[1000px] text-left text-xs"><thead className="sticky top-0 bg-[#f6f8f6]"><tr>{headings.map((h) => <th key={h} className="whitespace-nowrap border-b border-line px-3 py-2 text-[10px] font-semibold uppercase text-ink/50">{h}</th>)}</tr></thead><tbody className="divide-y divide-line">{query.data?.items.map((record) => {
      const d = record.data;
      const cells = kind === "worksite" ? [d.region, `${d.city}, ${d.province}`, d.category, d.wage_series || "Not linked"] : kind === "wage" ? [`${d.region} / ${d.category}`, d.order_reference, formatPesos(d.minimum_daily_centavos!), d.reviewed ? "Reviewed" : "Needs review"] : kind === "cooperative_policy" ? [formatPesos(d.deduction_centavos!)] : kind === "deduction" ? [d.employee_label || d.employee_id, d.deduction_type, d.deduction_mode === "fixed" ? "Employee request" : "Follow default", d.deduction_mode === "fixed" ? formatPesos(d.deduction_centavos!) : "Current policy", d.opening_balance_centavos ? formatPesos(d.opening_balance_centavos) : "Payment Settings target"] : [`${d.employee_label || "Client default"} / ${d.worksite_label || d.worksite_id}`, d.pay_basis, formatPesos(salaryAmount(d)), `${d.shift_start}–${d.shift_end}`, (d.rest_days || []).map((day) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day]).join(", ") || "None"];
      return <tr key={record.id} className={record.deleted_at ? "bg-gray-50 text-ink/45" : "hover:bg-paper"}><td className="px-3 py-2 font-semibold">{d.label}{record.deleted_at ? <span className="ml-2 text-[10px] font-normal">Archived</span> : null}</td>{cells.map((cell, i) => <td key={i} className={`px-3 py-2 ${i === 2 && kind !== "worksite" ? "whitespace-nowrap font-mono" : ""} ${kind === "wage" && i === 3 && !d.reviewed ? "text-amber-700" : ""}`}>{cell}</td>)}{kind !== "worksite" ? <><td className="whitespace-nowrap px-3 py-2 font-mono">{d.effective_from}</td><td className="whitespace-nowrap px-3 py-2 font-mono">{d.effective_to || "Next version"}</td></> : null}<td className="max-w-64 px-3 py-2"><span className="line-clamp-2" title={d.reason}>{d.reason}</span></td><td className="px-3 py-2"><div className="flex gap-1">{can("payroll.manage") ? <><button type="button" className="icon-button" title="Create new version" aria-label={`New version of ${d.label}`} onClick={() => setEditing({ source: record })}><Copy className="h-3.5 w-3.5" /></button>{!record.deleted_at ? <button type="button" className="icon-button" title="Archive setup record" aria-label={`Archive ${d.label}`} disabled={archive.isPending} onClick={() => confirm(`Archive ${d.label}? It will no longer be used in date previews. Historical data is retained.`, () => archive.mutate(record.id), "Archive payroll setup", "Archive")}><Archive className="h-3.5 w-3.5" /></button> : null}</> : null}</div></td></tr>;
    })}{query.isLoading || !query.data?.items.length ? <tr><td colSpan={headings.length} className="px-3 py-12 text-center text-ink/45">{query.isLoading && !accessError ? <LoadingProgress label="Loading payroll setup..." /> : "No matching records"}</td></tr> : null}</tbody></table></div>
    <PaginationControls page={page} pageSize={size} total={query.data?.total || 0} onPageChange={setPage} onPageSizeChange={(value) => { setSize(value); setPage(1); }} />
    {editing ? <PayrollRecordForm kind={kind} source={editing.source} repository={repository} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void refresh(); }} /> : null}
    {preview ? <PayrollDatePreview repository={repository} onClose={() => setPreview(false)} /> : null}
    </>}
  </section>;
}
