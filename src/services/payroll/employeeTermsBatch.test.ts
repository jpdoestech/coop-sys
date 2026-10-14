import { describe, expect, it } from "vitest";
import { buildEmployeeTerms } from "./employeeTermsBatch";
import type { PayrollData, PayrollRecord } from "../../types/payroll";
const employee = { id: "10000000-0000-4000-8000-000000000001", employee_number: "000001", first_name: "Juan", last_name: "Dela Cruz" };
const data: PayrollData = { label: "Terms", reason: "Agreement", employee_id: employee.id, worksite_id: "10000000-0000-4000-8000-000000000002", worksite_label: "Factory", effective_from: "2026-01-01", pay_basis: "monthly", monthly_mode: "daily_factor", monthly_factor: 26, rate_centavos: 60000, frequency: "semi_monthly", payroll_group: "A", shift_start: "08:00", shift_end: "17:00", break_minutes: 60, rest_days: [2], allowances: [{ name: "Meals", amount_centavos: 5000, basis: "worked_day", tax_treatment: "unreviewed" }] };
const record = { id: "10000000-0000-4000-8000-000000000003", kind: "employee_terms", data, deleted_at: null } as PayrollRecord;
describe("bulk employee terms", () => {
  it("changes only selected fields and retains each employee's monthly factor, worksite, allowances and rest days", () => {
    const input = buildEmployeeTerms(employee, [record], { ...data, pay_basis: "daily", rest_days: [0], allowances: [], rate_centavos: 65000, effective_from: "2026-10-15", reason: "Wage increase" }, ["rate"]);
    expect(input.data).toMatchObject({ pay_basis: "monthly", monthly_factor: 26, rest_days: [2], rate_centavos: 65000, effective_from: "2026-10-15", allowances: data.allowances });
    expect(input.expected_source_id).toBe(record.id);
    expect(record.data.rate_centavos).toBe(60000);
  });
  it("resolves the effective version for a backdated increase without reviving expired terms", () => {
    const later = { ...record, id: "10000000-0000-4000-8000-000000000004", data: { ...data, effective_from: "2026-11-01", effective_to: "2026-11-10", rest_days: [4] } };
    expect(buildEmployeeTerms(employee, [record, later], { ...data, effective_from: "2026-10-15", reason: "Backdated" }, ["rest"]).expected_source_id).toBe(record.id);
    expect(() => buildEmployeeTerms(employee, [record, later], { ...data, effective_from: "2026-11-15" }, ["rate"])).toThrow("no active terms");
  });
  it("allows explicit allowance removal and complete first-time assignments", () => {
    expect(buildEmployeeTerms(employee, [record], { ...data, effective_from: "2026-10-15", allowances: [] }, ["allowances"]).data.allowances).toEqual([]);
    expect(buildEmployeeTerms(employee, [], data, null).data.employee_id).toBe(employee.id);
    expect(() => buildEmployeeTerms(employee, [record], data, [])).toThrow("at least one");
  });
});
