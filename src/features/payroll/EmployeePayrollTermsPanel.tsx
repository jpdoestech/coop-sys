import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Wallet } from "lucide-react";
import { useAccess } from "../../services/access/useAccess";
import { createPayrollRepository } from "../../services/repositories/payrollRepositoryFactory";
import { effectivePayrollRecord, salaryAmount } from "../../services/payroll/payrollSetup";
import { formatPesos } from "../../services/payments/paymentMath";
import type { Employee } from "../../types/employee";

export function EmployeePayrollTermsPanel({ employee, onEdit }: { employee: Employee; onEdit: () => void }) {
  const { profile } = useAccess();
  const repository = useMemo(() => createPayrollRepository(profile), [profile]);
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const query = useQuery({ queryKey: ["employee-payroll-template", profile.userId, employee.id, date], queryFn: async () => {
    const records = await repository.workDateRecords(employee.id, date);
    const source = effectivePayrollRecord(records.filter((r) => r.kind === "employee_terms"), date);
    return { source, site: records.find((r) => r.kind === "worksite" && r.id === source?.data.worksite_id) };
  } });
  const d = query.data?.source?.data;
  return <section><div className="mb-3 flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">Employee payroll terms</h3><button type="button" className="secondary-button" onClick={onEdit}><Wallet className="h-4 w-4" />{d ? "Change terms" : "Set up terms"}</button></div>
    {query.isError ? <p role="alert" className="text-xs text-red-700">{query.error.message}</p> : query.isPending ? <p role="status" className="text-xs text-ink/55">Loading payroll terms...</p> : !d ? <p className="text-xs text-amber-800">No active employee terms.</p> : <><dl className="grid gap-3 text-xs sm:grid-cols-2">{[["Pay basis", d.pay_basis], ["Rate / salary", formatPesos(salaryAmount(d))], ["Worksite / region", `${query.data?.site?.data.label || d.worksite_label} / ${query.data?.site?.data.region || "Not set"}`], ["Rest days", d.rest_days?.map((n) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][n]).join(", ") || "None"], ["Shift / unpaid break", `${d.shift_start} - ${d.shift_end} / ${d.break_minutes} min`], ["Effective from", d.effective_from]].map(([label, value]) => <div key={label}><dt className="text-[10px] uppercase text-ink/50">{label}</dt><dd className="mt-1 break-words font-semibold">{value}</dd></div>)}</dl><div className="mt-4 border-t border-line pt-3"><h4 className="mb-2 text-xs font-semibold">Allowances</h4>{d.allowances?.length ? d.allowances.map((a, i) => <div key={i} className="mb-1 flex flex-wrap justify-between gap-2 text-xs"><span>{a.name} / {a.basis.replaceAll("_", " ")}</span><span className="font-mono">{formatPesos(a.amount_centavos)}</span></div>) : <p className="text-xs text-ink/55">None</p>}</div></>}
  </section>;
}
