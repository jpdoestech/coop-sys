import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Wallet, Receipt } from "lucide-react";
import { useAccess } from "../../services/access/useAccess";
import { createPayrollRepository } from "../../services/repositories/payrollRepositoryFactory";
import { createRepositories } from "../../services/repositories/repositoryFactory";
import type { PayrollRunRepository } from "../../services/repositories/PayrollRunRepository";
import type { PayrollRun } from "../../types/payrollRun";
import type { Employee } from "../../types/employee";
import type { PayrollInput } from "../../types/payroll";
import { PaginationControls } from "../../components/ui/PaginationControls";
import { EmployeePayrollTermsDialog } from "./EmployeePayrollTermsDialog";
import { PayrollRecordForm } from "./PayrollRecordForm";
import { showTransactionSuccess } from "../../services/activity/transactionNotifications";
import { validatePayrollInput } from "../../services/payroll/payrollSetup";

export function CutoffEmployeeSetup({ run, repository }: { run: PayrollRun; repository: PayrollRunRepository }) {
  const { profile, can } = useAccess(), client = useQueryClient();
  const payroll = useMemo(() => createPayrollRepository(profile), [profile]);
  const [page, setPage] = useState(1), [size, setSize] = useState(25);
  const [selected, setSelected] = useState<Set<string>>(new Set()), [employees, setEmployees] = useState<Employee[]>([]);
  const [action, setAction] = useState<"terms" | "deduction" | null>(null), [loading, setLoading] = useState(false), [error, setError] = useState("");
  const [prepared, setPrepared] = useState<PayrollInput[] | null>(null);
  const query = useQuery({ queryKey: ["payroll-run-coverage", profile.userId, run.id, page, size], queryFn: () => repository.coverage(run.id, size, (page - 1) * size) });
  const rows = query.data?.items || [];
  async function open(next: "terms" | "deduction") {
    setLoading(true); setError("");
    try {
      if (!selected.size || selected.size > 500) throw new Error("Select between 1 and 500 employees.");
      const found: Employee[] = [];
      for (const id of selected) { const employee = await createRepositories().employees.getById(id); if (!employee || employee.deleted_at) throw new Error("Employee is unavailable."); found.push(employee); }
      setEmployees(found); setPrepared(null); setAction(next);
    } catch (reason) { setError((reason as Error).message); } finally { setLoading(false); }
  }
  function select(ids: string[], checked: boolean) {
    const next = new Set(selected); ids.forEach((id) => { if (checked) next.add(id); else next.delete(id); });
    if (next.size > 500) { setError("Select no more than 500 employees."); return; } setSelected(next); setError("");
  }
  return <>
    <div className="data-toolbar"><span className="text-xs text-ink/55">{selected.size} selected</span>{can("payroll.manage") ? <><button className="secondary-button" disabled={!selected.size || loading} onClick={() => void open("terms")}><Wallet className="h-4 w-4" />Terms / allowances</button><button className="secondary-button" disabled={!selected.size || loading} onClick={() => void open("deduction")}><Receipt className="h-4 w-4" />Deduction plans</button></> : null}</div>
    {error || query.isError ? <p role="alert" className="bg-red-50 p-3 text-xs text-red-700">{error || query.error?.message}</p> : null}
    <div className="min-h-0 overflow-auto"><table className="w-full min-w-[650px] text-left text-xs"><thead className="sticky top-0 bg-paper"><tr>{can("payroll.manage") ? <th className="w-10 px-3 py-2"><input type="checkbox" aria-label="Select cutoff employees on this page" checked={rows.length > 0 && rows.every((r) => selected.has(r.employeeId))} disabled={loading} onChange={(e) => select(rows.map((r) => r.employeeId), e.target.checked)} /></th> : null}{["Employee", "Assignment-days", "Approved attendance", "Days needing review"].map((h) => <th key={h} className="px-3 py-2 text-[10px] uppercase text-ink/50">{h}</th>)}</tr></thead><tbody className="divide-y divide-line">{rows.map((r) => <tr key={r.employeeId}>{can("payroll.manage") ? <td className="px-3 py-2"><input type="checkbox" aria-label={`Select cutoff employee ${r.employeeLabel}`} checked={selected.has(r.employeeId)} disabled={loading} onChange={(e) => select([r.employeeId], e.target.checked)} /></td> : null}<td className="px-3 py-2 font-semibold">{r.employeeLabel}</td><td className="px-3 py-2 font-mono">{r.expected}</td><td className="px-3 py-2 font-mono">{r.approved}</td><td className="px-3 py-2 font-mono">{r.issues.length}</td></tr>)}{!rows.length ? <tr><td colSpan={5} className="px-3 py-10 text-center text-ink/45">{query.isFetching ? "Loading cutoff employees..." : "No dated employee assignments match this cutoff"}</td></tr> : null}</tbody></table></div>
    <PaginationControls page={page} pageSize={size} total={query.data?.total || 0} onPageChange={setPage} onPageSizeChange={(n) => { setSize(n); setPage(1); }} />
    {action === "terms" ? <EmployeePayrollTermsDialog employees={employees} run={run} onClose={() => setAction(null)} /> : null}
    {action === "deduction" ? <PayrollRecordForm kind="deduction" repository={payroll} employeeLocked title={`Deduction plans - ${employees.length} cutoff employees`} initialValues={{ label: "Cutoff deduction", employee_id: employees[0].id, effective_from: run.period_start, effective_to: run.period_end }} onDraftChange={() => setPrepared(null)} saveLabel={prepared ? `Apply ${employees.length} deduction plans` : "Review deduction plans"} extraFields={<div className="max-h-28 overflow-y-auto text-xs text-ink/65">{employees.map((e) => <p key={e.id}>{e.employee_number} - {e.last_name}, {e.first_name}{prepared ? " - Ready" : ""}</p>)}</div>}
      saveInput={async ({ data }) => {
        if (data.effective_from! < run.period_start || data.effective_from! > run.period_end || !data.effective_to || data.effective_to > run.period_end) throw new Error("Keep the effective dates within this cutoff.");
        if (!prepared) {
          if (data.deduction_type === "cooperative" && employees.some((e) => !e.member_id)) throw new Error("Every selected employee must have a linked member for cooperative deductions.");
          const inputs: PayrollInput[] = employees.map((e) => ({ kind: "deduction", data: { ...structuredClone(data), label: `${e.employee_number} - Cutoff deduction`, employee_id: e.id, employee_label: `${e.employee_number} - ${e.last_name}, ${e.first_name}` } }));
          inputs.forEach(validatePayrollInput); setPrepared(inputs); return false;
        }
        await payroll.saveBatch(prepared);
        await client.invalidateQueries({ queryKey: ["payroll-setup"] }); await client.invalidateQueries({ queryKey: ["payroll-work-date"] });
        await showTransactionSuccess("Cutoff deduction plans saved", `${prepared.length} dated plans saved. No deduction has been posted.`);
      }} onClose={() => setAction(null)} onSaved={() => setAction(null)} /> : null}
  </>;
}
