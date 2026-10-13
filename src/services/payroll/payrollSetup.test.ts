import { describe, expect, it } from "vitest";
import type { PayrollData, PayrollKind, PayrollRecord } from "../../types/payroll";
import { cooperativeDeductionForDate, effectivePayrollRecord, resolvePayrollWorkDate, salaryAmount, validatePayrollInput, validatePayrollRecords } from "./payrollSetup";

export const employeeId = "10000000-0000-4000-8000-000000000001";
export const siteId = "10000000-0000-4000-8000-000000000002";
export const termsData: PayrollData = { label: "Employee pay terms", reason: "Initial appointment", employee_id: employeeId, worksite_id: siteId, effective_from: "2026-01-01", effective_to: null, pay_basis: "daily", rate_centavos: 60000, monthly_mode: "direct", monthly_factor: null, frequency: "semi_monthly", payroll_group: "Production A", shift_start: "22:00", shift_end: "07:00", break_minutes: 60, rest_days: [0], allowances: [] };
export function record(number: number, kind: PayrollKind, data: PayrollData): PayrollRecord { return { id: `10000000-0000-4000-8000-${String(number).padStart(12, "0")}`, kind, data, created_by: employeeId, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", deleted_at: null }; }
const site = record(2, "worksite", { label: "Client plant", reason: "Registered worksite", branch_id: employeeId, region: "XI", province: "Davao del Sur", city: "Davao City", category: "Test category", wage_series: "TEST-XI" });
const wage = record(3, "wage", { label: "Wage rule", reason: "Reviewed order", series: "TEST-XI", region: "XI", category: "Test category", effective_from: "2026-01-01", minimum_daily_centavos: 55000, order_reference: "TEST-ONLY", source_url: "https://nwpc.dole.gov.ph/", reviewed: true });

describe("effective-dated payroll foundation", () => {
  it("defaults cooperative deductions to 50 per cutoff, follows policy changes, and preserves fixed employee requests", () => {
    expect(cooperativeDeductionForDate([], employeeId, "2026-10-01").amountCentavos).toBe(5000);
    const policy = record(6, "cooperative_policy", { label: "Cooperative cutoff policy", reason: "Approved policy change", effective_from: "2026-10-08", deduction_centavos: 7500 });
    expect(cooperativeDeductionForDate([policy], employeeId, "2026-10-07").amountCentavos).toBe(5000);
    expect(cooperativeDeductionForDate([policy], employeeId, "2026-10-08").amountCentavos).toBe(7500);
    const plan = record(7, "deduction", { label: "Employee request", reason: "Requested 100 per cutoff", employee_id: employeeId, effective_from: "2026-10-10", deduction_type: "cooperative", deduction_mode: "fixed", deduction_centavos: 10000 });
    expect(cooperativeDeductionForDate([policy, plan], employeeId, "2026-10-10")).toMatchObject({ amountCentavos: 10000, source: "Employee request" });
    const follow = record(8, "deduction", { ...plan.data, effective_from: "2026-10-15", deduction_mode: "follow_default" });
    expect(cooperativeDeductionForDate([policy, plan, follow], employeeId, "2026-10-15").amountCentavos).toBe(7500);
  });
  it("keeps loan and advance installments separate from cooperative defaults", () => {
    expect(() => validatePayrollInput({ kind: "deduction", data: { label: "Loan", reason: "Agreement", employee_id: employeeId, effective_from: "2026-10-01", deduction_type: "loan", deduction_mode: "follow_default" } })).toThrow("fixed installment");
    expect(() => validatePayrollInput({ kind: "deduction", data: { label: "Advance", reason: "Agreement", employee_id: employeeId, effective_from: "2026-10-01", deduction_type: "advance", deduction_mode: "fixed", deduction_centavos: 10000, opening_balance_centavos: 100000, deduction_reference: "ADV-001" } })).not.toThrow();
  });
  it("uses the work date and switches rates/rest days on the effective date", () => {
    const first = record(4, "employee_terms", termsData), next = record(5, "employee_terms", { ...termsData, effective_from: "2026-10-08", rate_centavos: 65000, rest_days: [2] });
    const records = [site, wage, first, next];
    expect(resolvePayrollWorkDate(records, employeeId, "2026-10-07").salaryCentavos).toBe(60000);
    expect(resolvePayrollWorkDate(records, employeeId, "2026-10-08").salaryCentavos).toBe(65000);
    expect(resolvePayrollWorkDate(records, employeeId, "2026-10-13").restDay).toBe(true);
    expect(first.data.rate_centavos).toBe(60000);
  });
  it("uses a one-day override without permanently changing the assignment", () => {
    const base = record(4, "employee_terms", termsData), override = record(5, "override", { ...termsData, effective_from: "2026-10-13", effective_to: "2026-10-13", rate_centavos: 70000 });
    expect(resolvePayrollWorkDate([site, wage, base, override], employeeId, "2026-10-13").terms?.id).toBe(override.id);
    expect(resolvePayrollWorkDate([site, wage, base, override], employeeId, "2026-10-14").salaryCentavos).toBe(60000);
  });
  it("does not revive an older version when later terms expire", () => {
    expect(effectivePayrollRecord([record(4, "employee_terms", termsData), record(5, "employee_terms", { ...termsData, effective_from: "2026-10-08", effective_to: "2026-10-10" })], "2026-10-11")).toBeNull();
  });
  it("resolves wage tranches by work date and reports rates below the registered minimum", () => {
    const nextWage = record(5, "wage", { ...wage.data, effective_from: "2026-10-08", minimum_daily_centavos: 65000 });
    const records = [site, wage, nextWage, record(4, "employee_terms", termsData)];
    expect(resolvePayrollWorkDate(records, employeeId, "2026-10-07").issues).toEqual([]);
    expect(resolvePayrollWorkDate(records, employeeId, "2026-10-08").issues).toContain("Reference daily rate is below the registered minimum wage.");
  });
  it("supports direct and derived monthly salaries without treating the factor as worked days", () => {
    expect(salaryAmount({ ...termsData, pay_basis: "monthly", monthly_mode: "daily_factor", monthly_factor: 26 })).toBe(1560000);
    expect(salaryAmount({ ...termsData, pay_basis: "monthly", monthly_mode: "direct", rate_centavos: 1800000 })).toBe(1800000);
    const preview = resolvePayrollWorkDate([site, wage, record(4, "employee_terms", { ...termsData, pay_basis: "monthly", monthly_mode: "direct", rate_centavos: 1800000 })], employeeId, "2026-10-14");
    expect(preview.issues).toContain("Direct monthly salary needs a reviewed daily-equivalent conversion policy.");
  });
  it("accepts overnight shifts but rejects invalid breaks, dates and duplicate versions", () => {
    expect(() => validatePayrollInput({ kind: "employee_terms", data: termsData })).not.toThrow();
    expect(() => validatePayrollInput({ kind: "employee_terms", data: { ...termsData, break_minutes: 540 } })).toThrow("shorter");
    expect(() => validatePayrollInput({ kind: "employee_terms", data: { ...termsData, effective_from: "2026-02-30" } })).toThrow("dates");
    expect(() => validatePayrollRecords([site, record(4, "employee_terms", termsData), record(5, "employee_terms", termsData)])).toThrow("already exists");
  });
  it("does not accept unofficial wage sources or multi-day overrides", () => {
    expect(() => validatePayrollInput({ kind: "wage", data: { ...wage.data, source_url: "https://dole.gov.ph.example.com/" } })).toThrow("official");
    expect(() => validatePayrollInput({ kind: "override", data: { ...termsData, effective_to: "2026-01-02" } })).toThrow("same work date");
  });
  it("flags missing, unreviewed and mismatched rules rather than silently certifying compliance", () => {
    const terms = record(4, "employee_terms", termsData);
    expect(resolvePayrollWorkDate([site, terms], employeeId, "2026-10-14").issues).toContain("No wage rule applies to this worksite and date.");
    expect(resolvePayrollWorkDate([site, terms, record(3, "wage", { ...wage.data, reviewed: false, region: "NCR" })], employeeId, "2026-10-14").issues).toHaveLength(2);
  });
});
