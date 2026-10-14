import type { PayrollData, PayrollInput, PayrollRecord } from "../../types/payroll";
import { effectivePayrollRecord, validatePayrollInput, validPayrollDate } from "./payrollSetup";

export const termsFieldGroups = {
  rate: { label: "Rate / salary", keys: ["rate_centavos"] },
  basis: { label: "Pay basis / monthly factor", keys: ["pay_basis", "monthly_mode", "monthly_factor"] },
  worksite: { label: "Worksite / region", keys: ["worksite_id", "worksite_label"] },
  duty: { label: "Department / position", keys: ["department_id", "position_id"] },
  schedule: { label: "Shift / break", keys: ["shift_start", "shift_end", "break_minutes", "duty_segments"] },
  rest: { label: "Rest days", keys: ["rest_days"] },
  allowances: { label: "Allowances", keys: ["allowances"] },
  group: { label: "Payroll group / frequency", keys: ["payroll_group", "frequency"] },
} as const;
export type TermsFieldGroup = keyof typeof termsFieldGroups;
export type TermsEmployee = { id: string; employee_number: string; first_name: string; last_name: string };
export async function prepareEmployeeTermsBatch(employees: TermsEmployee[], changes: PayrollData, fields: TermsFieldGroup[] | null, load: (id: string, date: string) => Promise<PayrollRecord[]>) {
  if (!employees.length || employees.length > 500 || new Set(employees.map((e) => e.id)).size !== employees.length) throw new Error("Select between 1 and 500 distinct employees.");
  if (!validPayrollDate(changes.effective_from)) throw new Error("Enter a valid effective date.");
  const inputs: PayrollInput[] = [], errors: string[] = [];
  let cursor = 0;
  async function worker() {
    while (cursor < employees.length) {
      const index = cursor++, employee = employees[index];
      try {
        const records = await load(employee.id, changes.effective_from!);
        if (records.some((r) => !r.deleted_at && r.kind === "employee_terms" && r.data.employee_id === employee.id && r.data.effective_from === changes.effective_from)) throw new Error("A version already exists on this effective date.");
        inputs[index] = buildEmployeeTerms(employee, records, changes, fields);
      } catch (reason) { errors.push(`${employee.employee_number}: ${(reason as Error).message}`); }
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, employees.length) }, worker));
  if (errors.length) throw new Error(errors.slice(0, 3).join(" ") + (errors.length > 3 ? ` ${errors.length - 3} more employees need correction.` : ""));
  return inputs;
}

export function buildEmployeeTerms(employee: TermsEmployee, records: PayrollRecord[], changes: PayrollData, fields: TermsFieldGroup[] | null): PayrollInput {
  if (!validPayrollDate(changes.effective_from)) throw new Error("Enter a valid effective date.");
  const base = effectivePayrollRecord(records.filter((r) => r.kind === "employee_terms" && r.data.employee_id === employee.id), changes.effective_from);
  if (fields && !base) throw new Error("no active terms on this date. Choose Assign complete terms.");
  if (fields && !fields.length) throw new Error("Select at least one field to update.");
  const data = structuredClone(fields ? base!.data : changes);
  if (fields) for (const group of fields) {
    if (!(group in termsFieldGroups)) throw new Error("Unknown payroll field group.");
    for (const key of termsFieldGroups[group].keys) Object.assign(data, { [key]: structuredClone(changes[key]) });
  }
  Object.assign(data, { label: `${employee.employee_number} - Pay terms`, employee_id: employee.id,
    employee_label: `${employee.employee_number} - ${employee.last_name}, ${employee.first_name}`,
    effective_from: changes.effective_from, effective_to: changes.effective_to || null, reason: changes.reason,
    source_terms_id: fields ? base!.id : changes.source_terms_id || null });
  const input: PayrollInput = { kind: "employee_terms", data, ...(fields ? { expected_source_id: base!.id } : {}) };
  validatePayrollInput(input);
  return input;
}
