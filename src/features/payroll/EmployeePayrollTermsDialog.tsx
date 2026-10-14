import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useAccess } from "../../services/access/useAccess";
import { createPayrollRepository } from "../../services/repositories/payrollRepositoryFactory";
import { assertPayrollAccess } from "../../services/payroll/payrollAccess";
import { effectivePayrollRecord, salaryAmount } from "../../services/payroll/payrollSetup";
import type { PayrollInput } from "../../types/payroll";
import { formatPesos } from "../../services/payments/paymentMath";
import { prepareEmployeeTermsBatch, termsFieldGroups, type TermsEmployee, type TermsFieldGroup } from "../../services/payroll/employeeTermsBatch";
import { showTransactionSuccess } from "../../services/activity/transactionNotifications";
import { PayrollRecordForm } from "./PayrollRecordForm";
import type { PayrollRun } from "../../types/payrollRun";

export function EmployeePayrollTermsDialog({ employees, onClose, run }: { employees: TermsEmployee[]; onClose: () => void; run?: PayrollRun }) {
  const { profile } = useAccess(), client = useQueryClient();
  const repository = useMemo(() => createPayrollRepository(profile), [profile]);
  const date = run?.period_start || new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [mode, setMode] = useState<"patch" | "assign">(employees.length > 1 ? "patch" : "assign");
  const [fields, setFields] = useState<TermsFieldGroup[]>(["rate"]);
  const [prepared, setPrepared] = useState<{ signature: string; inputs: PayrollInput[] } | null>(null);
  let accessError = ""; try { assertPayrollAccess(profile, true); } catch (error) { accessError = (error as Error).message; }
  const query = useQuery({ queryKey: ["employee-payroll-template", profile.userId, employees[0]?.id, date], queryFn: async () => {
    const records = await repository.workDateRecords(employees[0].id, date);
    const source = effectivePayrollRecord(records.filter((r) => r.kind === "employee_terms"), date);
    return { source, site: records.find((r) => r.kind === "worksite" && r.id === source?.data.worksite_id) };
  }, enabled: !accessError && employees.length > 0 });
  if (accessError || query.isPending || query.isError || !employees.length) return <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-3"><section role="dialog" aria-modal="true" aria-label="Employee payroll terms" className="w-full max-w-lg rounded-md bg-white p-4"><div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Employee payroll terms</h2><button className="icon-button" aria-label="Close payroll terms" onClick={onClose}><X className="h-4 w-4" /></button></div><p role={accessError || query.isError ? "alert" : "status"} className="mt-3 text-xs">{accessError || query.error?.message || (!employees.length ? "Select employees." : "Loading employee terms...")}</p></section></div>;
  const employee = employees[0], template = query.data!;
  return <PayrollRecordForm kind="employee_terms" repository={repository} source={template.source || undefined} employeeLocked title={employees.length === 1 ? `${employee.employee_number} - Employee payroll terms` : `Payroll terms - ${employees.length} employees`}
    activeGroups={mode === "patch" ? fields : undefined} externalDirty={mode !== (employees.length > 1 ? "patch" : "assign") || fields.join(",") !== "rate"}
    onDraftChange={() => setPrepared(null)} saveLabel={prepared ? `Apply ${employees.length} employee changes` : "Review changes"}
    initialValues={{ label: `${employee.employee_number} - Pay terms`, employee_id: employee.id, employee_label: `${employee.employee_number} - ${employee.last_name}, ${employee.first_name}`, branch_id: template.site?.data.branch_id, client_id: template.site?.data.client_id, ...(run ? { effective_from: run.period_start } : {}) }}
    extraFields={<><div className="mb-3 max-h-20 overflow-y-auto border-b border-line pb-2 text-xs text-ink/65">{employees.map((e) => <span key={e.id} className="mr-3 inline-block">{e.employee_number} - {e.last_name}, {e.first_name}</span>)}</div><label className="field-label">Change mode<select className="compact-control mt-1 w-full" value={mode} onChange={(e) => { setPrepared(null); setMode(e.target.value as typeof mode); }}><option value="patch">Update selected fields</option><option value="assign">Assign complete terms</option></select></label>{mode === "patch" ? <fieldset className="mt-3"><legend className="mb-2 text-xs font-semibold">Fields to update</legend><div className="grid gap-2 sm:grid-cols-2">{(Object.keys(termsFieldGroups) as TermsFieldGroup[]).map((key) => <label key={key} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={fields.includes(key)} onChange={(e) => { setPrepared(null); setFields((f) => e.target.checked ? [...f, key] : f.filter((g) => g !== key)); }} />{termsFieldGroups[key].label}</label>)}</div></fieldset> : null}{prepared ? <div className="mt-3 max-h-48 overflow-auto border-y border-line"><table aria-label="Employee terms change preview" className="w-full min-w-[550px] text-left text-xs"><thead className="sticky top-0 bg-paper"><tr>{["Employee", "Worksite", "Pay basis", "Rate / salary", "Rest days", "Allowances"].map((h) => <th key={h} className="px-2 py-2 text-[10px] uppercase text-ink/50">{h}</th>)}</tr></thead><tbody>{prepared.inputs.map(({ data: d }) => <tr key={d.employee_id} className="border-t border-line"><td className="px-2 py-2">{d.employee_label}</td><td className="px-2 py-2">{d.worksite_label || d.worksite_id}</td><td className="px-2 py-2">{d.pay_basis}</td><td className="px-2 py-2 font-mono">{formatPesos(salaryAmount(d))}</td><td className="px-2 py-2">{d.rest_days?.map((n) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][n]).join(", ") || "None"}</td><td className="px-2 py-2">{d.allowances?.length || 0}</td></tr>)}</tbody></table></div> : null}</>}
    saveInput={async ({ data }) => {
      if (employees.length > 500) throw new Error("Select no more than 500 employees.");
      if (run && (data.effective_from! < run.period_start || data.effective_from! > run.period_end)) throw new Error("Start the terms change within this cutoff.");
      const signature = JSON.stringify({ data, mode, fields });
      if (!prepared || prepared.signature !== signature) {
      const inputs = await prepareEmployeeTermsBatch(employees, data, mode === "patch" ? fields : null, (id, day) => repository.workDateRecords(id, day));
      setPrepared({ signature, inputs }); return false;
      }
      const inputs = prepared.inputs;
      await repository.saveBatch(inputs);
      await client.invalidateQueries({ queryKey: ["payroll-setup"] });
      await client.invalidateQueries({ queryKey: ["payroll-work-date"] });
      await client.invalidateQueries({ queryKey: ["employee-payroll-template"] });
      await client.invalidateQueries({ queryKey: ["attendance-team"] });
      await client.invalidateQueries({ queryKey: ["payroll-run-coverage"] });
      await showTransactionSuccess("Employee payroll terms saved", `${inputs.length} effective-dated employee versions saved.`);
    }} onClose={onClose} onSaved={onClose} />;
}
