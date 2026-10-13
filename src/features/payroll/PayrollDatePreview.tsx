import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, X } from "lucide-react";
import { useWorkspaceDialog } from "../../components/layout/WorkspaceNavigation";
import { createRepositories } from "../../services/repositories/repositoryFactory";
import type { PayrollRepository } from "../../services/repositories/PayrollRepository";
import { cooperativeDeductionForDate, resolvePayrollWorkDate, validPayrollDate } from "../../services/payroll/payrollSetup";
import { formatPesos } from "../../services/payments/paymentMath";
import { PayrollLookup } from "./PayrollLookup";

export function PayrollDatePreview({ repository, onClose }: { repository: PayrollRepository; onClose: () => void }) {
  useWorkspaceDialog("Work-Date Preview", onClose);
  const [employee, setEmployee] = useState({ id: "", label: "" });
  const [date, setDate] = useState(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()));
  const load = useCallback(async (search: string) => (await createRepositories().employees.listPage({ search, limit: 20 })).items.map((e) => ({ id: e.id, label: `${e.employee_number} - ${e.last_name}, ${e.first_name}` })), []);
  const query = useQuery({ queryKey: ["payroll-work-date", employee.id, date], queryFn: () => repository.workDateRecords(employee.id, date), enabled: Boolean(employee.id) && validPayrollDate(date) });
  const result = query.data ? resolvePayrollWorkDate(query.data, employee.id, date) : null;
  const employeeRecord = useQuery({ queryKey: ["payroll-preview-employee", employee.id], queryFn: () => createRepositories().employees.getById(employee.id), enabled: Boolean(employee.id) });
  const cooperative = query.data ? cooperativeDeductionForDate(query.data, employee.id, date) : null;
  const d = result?.terms?.data;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-3"><section role="dialog" aria-modal="true" aria-label="Work-date preview" className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-md bg-white shadow-xl"><header className="flex items-center justify-between border-b border-line px-4 py-3"><h2 className="text-sm font-semibold">Work-Date Preview</h2><button type="button" className="icon-button" title="Close preview" aria-label="Close preview" onClick={onClose}><X className="h-4 w-4" /></button></header><div className="grid gap-3 p-4 sm:grid-cols-2"><PayrollLookup label="Employee" value={employee.id} selectedLabel={employee.label} load={load} onChange={(id, label) => setEmployee({ id, label })} /><label className="field-label">Work date<input type="date" className="compact-control mt-1 w-full" value={date} onInput={(e) => setDate(e.currentTarget.value)} onChange={(e) => setDate(e.target.value)} /></label></div>
    {query.isFetching ? <p className="px-4 pb-4 text-xs text-ink/55">Loading applicable terms...</p> : query.isError ? <p role="alert" className="px-4 pb-4 text-xs text-red-700">{query.error.message}</p> : null}
    {result && !query.isFetching ? <><dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line p-4 text-xs">{[
      ["Worksite", result.site?.data.label || "Unassigned"], ["Terms", result.terms?.data.label || "Missing"], ["Source", result.terms?.kind === "override" ? "Daily override" : "Employee terms"], ["Effective from", d?.effective_from || "-"],
      ["Pay basis", d?.pay_basis || "-"], ["Base salary / rate", d ? formatPesos(result.salaryCentavos) : "-"], ["Shift", d ? `${d.shift_start}–${d.shift_end}` : "-"], ["Day type", result.restDay ? "Rest day" : "Scheduled workday"], ["Wage order", result.wage?.data.order_reference || "Missing"], ["Registered daily minimum", result.wage ? formatPesos(result.wage.data.minimum_daily_centavos!) : "-"],
    ].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-[10px] uppercase text-ink/45">{label}</dt><dd className="mt-1 break-words font-semibold">{value}</dd></div>)}</dl>
      {d?.allowances?.length ? <div className="border-t border-line px-4 py-3 text-xs">{d.allowances.map((a, i) => <p key={i} className="flex flex-wrap justify-between gap-2 py-1"><span>{a.name} / {a.basis.replaceAll("_", " ")}</span><span className="font-mono">{formatPesos(a.amount_centavos)}</span></p>)}</div> : null}
      {cooperative ? <div className="flex flex-wrap justify-between gap-2 border-t border-line px-4 py-3 text-xs"><span>Cooperative per cutoff / {cooperative.source}</span><span className="font-mono">{employeeRecord.isFetching ? "Loading member link..." : employeeRecord.isError ? "Member link unavailable" : employeeRecord.data?.member_id ? formatPesos(cooperative.amountCentavos) : "Not a linked cooperative member"}</span></div> : null}
      {result.issues.length ? <ul className="border-t border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">{result.issues.map((issue) => <li key={issue} className="flex gap-2 py-1"><AlertTriangle className="h-3.5 w-3.5 shrink-0" />{issue}</li>)}</ul> : <p className="border-t border-line px-4 py-3 text-xs text-moss">No setup discrepancies detected for this date.</p>}
    </> : null}</section></div>;
}
