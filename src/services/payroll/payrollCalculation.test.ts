import { describe, expect, it } from "vitest";
import { calculateDraftPage, currentCalculationRule, validateCalculationRule } from "./payrollCalculation";
import type { CalculationSource, CalculationRule } from "../../types/payrollCalculation";
import type { PayrollRecord } from "../../types/payroll";
import type { AttendanceRecord } from "../../types/attendance";
import type { PayrollRun } from "../../types/payrollRun";
const ids = Array.from({ length: 10 }, (_, i) => `10000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`);
const site = { id: ids[0], kind: "worksite", data: { label: "Factory", reason: "Agreement", wage_series: "XI-Production", region: "XI", category: "Production" }, deleted_at: null } as PayrollRecord;
const terms: PayrollRecord = { id: ids[1], kind: "employee_terms", data: { label: "Operator", reason: "Agreement", employee_id: ids[2], worksite_id: site.id, effective_from: "2026-01-01", pay_basis: "daily", rate_centavos: 60000, frequency: "semi_monthly", payroll_group: "A", shift_start: "08:00", shift_end: "17:00", break_minutes: 60, rest_days: [0], allowances: [{ name: "Meal", basis: "worked_day", amount_centavos: 10000, tax_treatment: "non_taxable" }] }, created_by: ids[3], created_at: "2026-01-01", updated_at: "2026-01-01", deleted_at: null };
const wage = { id: ids[4], kind: "wage", data: { label: "Reviewed wage", reason: "Register", series: "XI-Production", region: "XI", category: "Production", minimum_daily_centavos: 55000, reviewed: true, effective_from: "2026-01-01" }, deleted_at: null } as PayrollRecord;
const policy: CalculationRule = { id: ids[5], kind: "policy", worksite_id: site.id, payroll_group: "A", effective_from: "2026-01-01", regular_minutes: 480, short_day: "proportional", worked_allowance: "proportional", reviewed: true, reference: "Approved ordinary-day policy", created_by: ids[3], created_at: "2026-01-01T00:00:00Z" };
const calendar: CalculationRule = { id: ids[6], kind: "calendar", worksite_id: site.id, payroll_group: "", effective_from: "2026-10-12", day_type: "ordinary", reviewed: true, reference: "Verified calendar", created_by: ids[3], created_at: "2026-01-01T00:00:00Z" };
function source(): CalculationSource {
  const attendance = { id: ids[7], employee_id: ids[2], employee_label: "Juan", work_date: calendar.effective_from, status: "present", review_status: "approved", terms_id: terms.id, reason: "Log", segments: [{ time_in: "08:30", time_out: "17:00", in_next_day: false, out_next_day: false, break_minutes: 60 }] } as AttendanceRecord;
  return { run: { id: ids[8], worksite_id: site.id, payroll_group: "A", frequency: "semi_monthly", period_start: calendar.effective_from, period_end: calendar.effective_from, status: "draft" } as PayrollRun, setup: [site, terms, wage], rules: [policy, calendar], members: { [ids[2]]: true }, total: 1, rows: [{ employeeId: ids[2], employeeLabel: "000001 - Dela Cruz, Juan", date: calendar.effective_from, terms, baseTerms: terms, attendance, neighbors: [], restDay: false }] };
}
describe("ordinary-day calculation draft", () => {
  it("calculates reviewed actual minutes and rounds centavos without deductions or net pay", () => {
    const [r] = calculateDraftPage(source());
    expect(r).toMatchObject({ baseCentavos: 56250, allowanceCentavos: 9375, subtotalCentavos: 65625, cooperativePlanCentavos: 5000, issues: [] });
    expect(r.days[0]).toMatchObject({ workedMinutes: 450, regularMinutes: 480, attendanceId: ids[7], termsId: terms.id, policyId: policy.id, calendarId: calendar.id });
    expect(r).not.toHaveProperty("netPay");
  });
  it("resolves dated rate changes and shows a fixed employee installment once per cutoff", () => {
    const s = source(), newer = { ...terms, id: ids[9], data: { ...terms.data, effective_from: "2026-10-13", rate_centavos: 65000 } };
    s.setup.push(newer, { ...terms, kind: "deduction", data: { label: "Request", reason: "Employee request", employee_id: ids[2], effective_from: "2026-01-01", deduction_type: "cooperative", deduction_mode: "fixed", deduction_centavos: 10000 } });
    s.run.period_end = "2026-10-13"; s.rules.push({ ...calendar, id: ids[8], effective_from: "2026-10-13" });
    s.rows.push({ ...s.rows[0], date: "2026-10-13", terms: newer, attendance: { ...s.rows[0].attendance!, terms_id: newer.id, work_date: "2026-10-13" } });
    const [r] = calculateDraftPage(s);
    expect(r.days[1].baseCentavos).toBe(60938); expect(r.baseCentavos).toBe(117188); expect(r.cooperativePlanCentavos).toBe(10000);
  });
  it("blocks missing/unreviewed rules without falling back to an earlier reviewed version", () => {
    const s = source(); s.rules.push({ ...policy, id: ids[8], reviewed: false, created_at: "2026-10-01T00:00:00Z" });
    expect(currentCalculationRule(s.rules, calendar.effective_from, "policy", "A")?.reviewed).toBe(false);
    expect(calculateDraftPage(s)[0].subtotalCentavos).toBeNull();
    s.rules = [policy]; expect(calculateDraftPage(s)[0].issues).toContain("Missing / unreviewed day classification");
  });
  it("blocks holidays, monthly wages, paid leave, overtime, nights, and rest-day work", () => {
    for (const variant of ["holiday", "monthly", "leave", "overtime", "night", "rest"]) {
      const s = source();
      if (variant === "holiday") s.rules[1] = { ...calendar, day_type: "regular_holiday" };
      if (variant === "monthly") { s.rows[0].terms = { ...terms, data: { ...terms.data, pay_basis: "monthly", monthly_mode: "direct" } }; s.setup[1] = s.rows[0].terms; }
      if (variant === "leave") { s.rows[0].attendance!.status = "paid_leave"; s.rows[0].attendance!.segments = []; }
      if (variant === "overtime") s.rows[0].attendance!.segments[0].time_out = "18:00";
      if (variant === "night") s.rows[0].attendance!.segments[0].time_in = "05:00";
      if (variant === "rest") { s.rows[0].terms = { ...terms, data: { ...terms.data, rest_days: [1] } }; s.setup[1] = s.rows[0].terms; }
      expect(calculateDraftPage(s)[0].subtotalCentavos, variant).toBeNull();
    }
  });
  it("blocks pending attendance, stale terms, unreviewed allowances, cutoff allowances and inconsistent minutes", () => {
    const pending = source(); pending.rows[0].attendance!.review_status = "draft"; expect(calculateDraftPage(pending)[0].issues).toContain("Attendance must be approved");
    const stale = source(); stale.rows[0].attendance!.terms_id = ids[9]; expect(calculateDraftPage(stale)[0].subtotalCentavos).toBeNull();
    for (const data of [{ allowances: [{ name: "Meal", amount_centavos: 10000, basis: "worked_day" as const, tax_treatment: "unreviewed" as const }] }, { allowances: [{ name: "Bonus", amount_centavos: 10000, basis: "cutoff" as const, tax_treatment: "taxable" as const }] }]) {
      const s = source(); s.rows[0].terms = { ...terms, data: { ...terms.data, ...data } }; s.setup[1] = s.rows[0].terms;
      expect(calculateDraftPage(s)[0].subtotalCentavos).toBeNull();
    }
    const inconsistent = source(); inconsistent.rules[0] = { ...policy, regular_minutes: 450 }; expect(calculateDraftPage(inconsistent)[0].subtotalCentavos).toBeNull();
  });
  it("requires full policy fields and rejects duplicate source days", () => {
    expect(() => validateCalculationRule({ ...policy, regular_minutes: undefined })).toThrow("regular minutes");
    const s = source(); s.rows.push(s.rows[0]); expect(() => calculateDraftPage(s)).toThrow("duplicate");
  });
  it("keeps reviewed non-working ordinary days at zero and never applies the planned cooperative amount", () => {
    for (const status of ["absent", "unpaid_leave", "rest_day"] as const) {
      const s = source(); s.rows[0].attendance!.status = status; s.rows[0].attendance!.segments = [];
      if (status === "rest_day") { s.rows[0].terms = { ...terms, data: { ...terms.data, rest_days: [1] } }; s.setup[1] = s.rows[0].terms; }
      const r = calculateDraftPage(s)[0];
      expect(r.subtotalCentavos).toBe(0); expect(r.cooperativePlanCentavos).toBe(5000);
    }
    const changed = source(); changed.setup.push({ ...terms, kind: "cooperative_policy", data: { label: "New default", reason: "Review", effective_from: calendar.effective_from, deduction_centavos: 7500 } });
    expect(calculateDraftPage(changed)[0].cooperativePlanCentavos).toBe(7500);
    changed.members = {}; expect(calculateDraftPage(changed)[0].cooperativePlanCentavos).toBeNull();
  });
});
