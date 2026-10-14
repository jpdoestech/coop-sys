import type { PayrollData, PayrollInput, PayrollRecord } from "../../types/payroll";
import { validateDutySchedule } from "./payrollSchedule";

export const payrollKinds = ["worksite", "wage", "client_terms", "employee_terms", "override", "cooperative_policy", "deduction"] as const;
export const payrollStorageKey = "coop_sys_payroll_setup";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validPayrollDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
function requiredText(value: unknown, field: string, max = 200) {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error(`${field} is required (maximum ${max} characters).`);
}
function positiveMoney(value: unknown, field: string) {
  if (!Number.isSafeInteger(value) || Number(value) <= 0 || Number(value) > 100000000000) throw new Error(`${field} must be a positive centavo amount.`);
}
export function validatePayrollInput(input: PayrollInput) {
  if (!payrollKinds.includes(input.kind)) throw new Error("Unknown payroll setup record.");
  const d = input.data;
  requiredText(d.label, "Name"); requiredText(d.reason, "Change reason", 1000);
  if (input.kind === "worksite") {
    if (!uuid.test(d.branch_id || "") || d.client_id && !uuid.test(d.client_id)) throw new Error("Select a valid branch and client.");
    requiredText(d.region, "Worksite region"); requiredText(d.province, "Province"); requiredText(d.city, "City / municipality"); requiredText(d.category, "Wage category");
    return;
  }
  if (!validPayrollDate(d.effective_from) || d.effective_to && (!validPayrollDate(d.effective_to) || d.effective_to < d.effective_from)) throw new Error("Enter valid effective dates in chronological order.");
  if (input.kind === "cooperative_policy") {
    positiveMoney(d.deduction_centavos, "Cooperative deduction per cutoff");
    return;
  }
  if (input.kind === "deduction") {
    if (!uuid.test(d.employee_id || "")) throw new Error("Select an employee.");
    if (!["cooperative", "loan", "advance"].includes(d.deduction_type || "") || !["follow_default", "fixed"].includes(d.deduction_mode || "")) throw new Error("Select deduction type and amount policy.");
    if (d.deduction_mode === "fixed") positiveMoney(d.deduction_centavos, "Deduction per cutoff");
    if (d.deduction_type !== "cooperative") {
      if (d.deduction_mode !== "fixed") throw new Error("Loans and advances require a fixed installment amount.");
      positiveMoney(d.opening_balance_centavos, "Opening balance"); requiredText(d.deduction_reference, "Loan / advance reference");
    }
    return;
  }
  if (input.kind === "wage") {
    requiredText(d.series, "Wage series"); requiredText(d.region, "Region"); requiredText(d.category, "Wage category"); requiredText(d.order_reference, "Wage order / tranche");
    positiveMoney(d.minimum_daily_centavos, "Daily minimum");
    let source: URL;
    try { source = new URL(d.source_url || ""); } catch { throw new Error("Enter an official HTTPS source URL."); }
    if (source.protocol !== "https:" || !/(^|\.)(nwpc\.dole\.gov\.ph|dole\.gov\.ph)$/.test(source.hostname)) throw new Error("Use an official DOLE or NWPC HTTPS source.");
    if (typeof d.reviewed !== "boolean") throw new Error("Specify the wage-rule review status.");
    return;
  }
  if (!uuid.test(d.worksite_id || "")) throw new Error("Select a worksite.");
  if (input.kind !== "client_terms" && !uuid.test(d.employee_id || "")) throw new Error("Select an employee.");
  if (input.kind === "client_terms" && d.employee_id) throw new Error("Client defaults cannot belong to an employee.");
  for (const id of [d.department_id, d.position_id, d.source_terms_id]) if (id && !uuid.test(id)) throw new Error("Invalid payroll reference.");
  if (input.kind === "override" && d.effective_to !== d.effective_from) throw new Error("Daily overrides must start and end on the same work date.");
  if (!["daily", "monthly"].includes(d.pay_basis || "")) throw new Error("Select a pay basis.");
  positiveMoney(d.rate_centavos, "Base rate");
  if (d.pay_basis === "monthly") {
    if (!["direct", "daily_factor"].includes(d.monthly_mode || "")) throw new Error("Select how the monthly salary is entered.");
    if (d.monthly_mode === "daily_factor" && (!Number.isFinite(d.monthly_factor) || Number(d.monthly_factor) <= 0 || Number(d.monthly_factor) > 366)) throw new Error("Enter a salary factor greater than zero and no more than 366.");
  }
  if (!["weekly", "semi_monthly", "monthly"].includes(d.frequency || "")) throw new Error("Select payroll frequency.");
  requiredText(d.payroll_group, "Payroll group");
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(d.shift_start || "") || !/^([01]\d|2[0-3]):[0-5]\d$/.test(d.shift_end || "")) throw new Error("Enter valid shift times.");
  const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  const duration = (minutes(d.shift_end!) - minutes(d.shift_start!) + 1440) % 1440;
  if (!Number.isInteger(d.break_minutes) || Number(d.break_minutes) < 0 || Number(d.break_minutes) >= duration) throw new Error("Unpaid breaks must be shorter than the shift.");
  validateDutySchedule(d);
  if (!Array.isArray(d.rest_days) || new Set(d.rest_days).size !== d.rest_days.length || d.rest_days.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) throw new Error("Select valid rest days.");
  if (!Array.isArray(d.allowances) || d.allowances.length > 30) throw new Error("A maximum of 30 allowance components is supported.");
  for (const a of d.allowances) {
    requiredText(a.name, "Allowance name"); positiveMoney(a.amount_centavos, "Allowance amount");
    if (!["worked_day", "cutoff", "month"].includes(a.basis) || !["unreviewed", "taxable", "non_taxable"].includes(a.tax_treatment)) throw new Error("Select allowance basis and tax treatment.");
  }
}
export function payrollVersionKey(record: PayrollInput) {
  const d = record.data;
  return record.kind === "cooperative_policy" ? "cooperative_policy" : record.kind === "deduction" ? `deduction:${d.employee_id}:${d.deduction_type}:${d.deduction_type === "cooperative" ? "" : d.deduction_reference}` : record.kind === "wage" ? `wage:${d.series}` : record.kind === "client_terms" ? `client_terms:${d.worksite_id}:${d.department_id || ""}:${d.position_id || ""}` : `${record.kind}:${d.employee_id || d.label}`;
}
export function validatePayrollRecords(records: PayrollRecord[]) {
  const ids = new Set<string>(), versions = new Set<string>();
  for (const r of records) {
    if (!uuid.test(r.id) || ids.has(r.id)) throw new Error("Invalid or duplicate payroll record ID.");
    ids.add(r.id);
    if (r.deleted_at) continue;
    validatePayrollInput(r);
    if (r.kind === "worksite") {
      const key = `worksite:${r.data.branch_id}:${r.data.client_id || ""}:${r.data.label.trim().toLowerCase()}`;
      if (versions.has(key)) throw new Error("A worksite with this name already exists for the branch/client.");
      versions.add(key);
    }
    if (r.kind !== "worksite") {
      const key = `${payrollVersionKey(r)}:${r.data.effective_from}`;
      if (versions.has(key)) throw new Error("A version already exists for this effective date. Archive an incorrect setup record before replacing it.");
      versions.add(key);
    }
    if (["client_terms", "employee_terms", "override"].includes(r.kind) && !records.some((site) => site.id === r.data.worksite_id && site.kind === "worksite" && !site.deleted_at)) throw new Error("The selected worksite is unavailable.");
  }
}
// A later version supersedes an earlier one; expiry never revives older terms.
export function effectivePayrollRecord(records: PayrollRecord[], date: string) {
  const latest = records.filter((r) => !r.deleted_at && r.data.effective_from! <= date).sort((a, b) => b.data.effective_from!.localeCompare(a.data.effective_from!))[0];
  return latest && (!latest.data.effective_to || latest.data.effective_to >= date) ? latest : null;
}
export function salaryAmount(d: PayrollData) {
  return d.pay_basis === "monthly" && d.monthly_mode === "daily_factor" ? Math.round(d.rate_centavos! * d.monthly_factor!) : d.rate_centavos!;
}
export function resolvePayrollWorkDate(records: PayrollRecord[], employeeId: string, date: string) {
  if (!validPayrollDate(date)) throw new Error("Enter a valid work date.");
  const override = records.find((r) => r.kind === "override" && !r.deleted_at && r.data.employee_id === employeeId && r.data.effective_from === date);
  const terms = override ?? effectivePayrollRecord(records.filter((r) => r.kind === "employee_terms" && r.data.employee_id === employeeId), date);
  if (!terms) return { terms: null, site: null, wage: null, salaryCentavos: 0, restDay: false, issues: ["No employee pay terms apply to this work date."] };
  const d = terms.data, site = records.find((r) => r.kind === "worksite" && !r.deleted_at && r.id === d.worksite_id) ?? null;
  const wage = site?.data.wage_series ? effectivePayrollRecord(records.filter((r) => r.kind === "wage" && r.data.series === site.data.wage_series), date) : null;
  const issues: string[] = [];
  if (!site) issues.push("Worksite is unavailable.");
  if (!wage) issues.push("No wage rule applies to this worksite and date.");
  else {
    if (!wage.data.reviewed) issues.push("Wage rule is awaiting payroll review.");
    if (wage.data.region !== site?.data.region || wage.data.category !== site?.data.category) issues.push("Wage rule does not match the worksite region/category.");
    const daily = d.pay_basis === "daily" || d.monthly_mode === "daily_factor" ? d.rate_centavos : null;
    if (daily === null) issues.push("Direct monthly salary needs a reviewed daily-equivalent conversion policy.");
    else if (daily! < wage.data.minimum_daily_centavos!) issues.push("Reference daily rate is below the registered minimum wage.");
    if (d.pay_basis === "monthly" && d.monthly_mode === "daily_factor") issues.push("Monthly salary factor requires policy review; this preview is not a statutory compliance certification.");
  }
  if (d.allowances?.some((a) => a.tax_treatment === "unreviewed")) issues.push("Allowance tax treatment requires review.");
  return { terms, site, wage, salaryCentavos: salaryAmount(d), restDay: (d.rest_days || []).includes(new Date(`${date}T00:00:00Z`).getUTCDay()), issues };
}

export function cooperativeDeductionForDate(records: PayrollRecord[], employeeId: string, date: string) {
  if (!validPayrollDate(date)) throw new Error("Enter a valid deduction date.");
  const policy = effectivePayrollRecord(records.filter((r) => r.kind === "cooperative_policy"), date);
  const plan = effectivePayrollRecord(records.filter((r) => r.kind === "deduction" && r.data.employee_id === employeeId && r.data.deduction_type === "cooperative"), date);
  return { amountCentavos: plan?.data.deduction_mode === "fixed" ? plan.data.deduction_centavos! : policy?.data.deduction_centavos ?? 5000, source: plan?.data.deduction_mode === "fixed" ? "Employee request" : policy ? "Cooperative policy" : "Default policy", policy, plan };
}
