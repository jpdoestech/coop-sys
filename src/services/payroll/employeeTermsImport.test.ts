import { describe, expect, it } from "vitest";
import { employeeTermsImportInput, prepareEmployeeTermsImport } from "./employeeTermsImport";
import type { PayrollRecord } from "../../types/payroll";
const employee = { id: "10000000-0000-4000-8000-000000000001", employee_number: "000001", first_name: "Juan", last_name: "Dela Cruz" };
const record = { id: "10000000-0000-4000-8000-000000000002", kind: "employee_terms", deleted_at: null, data: { label: "Terms", reason: "Agreement", employee_id: employee.id, worksite_id: "10000000-0000-4000-8000-000000000003", effective_from: "2026-01-01", pay_basis: "daily", rate_centavos: 60000, frequency: "semi_monthly", payroll_group: "A", shift_start: "08:00", shift_end: "17:00", break_minutes: 60, rest_days: [0], allowances: [{ name: "Meals", amount_centavos: 5000, basis: "worked_day", tax_treatment: "unreviewed" }] } } as PayrollRecord;
const row = { "EMPLOYEE ID": "000001", "EFFECTIVE DATE": "2026-10-15", RATE: "650.50", REASON: "Wage increase" };
describe("salary terms imports", () => {
  it("preserves split duties in a rate import and rejects legacy schedule replacement", () => {
    const split = { ...record, data: { ...record.data, duty_segments: [{ time_in: "08:00", time_out: "12:00", in_next_day: false, out_next_day: false, break_minutes: 0 }, { time_in: "13:00", time_out: "17:00", in_next_day: false, out_next_day: false, break_minutes: 0 }] } };
    expect(employeeTermsImportInput(row, employee, [split]).data.duty_segments).toEqual(split.data.duty_segments);
    expect(() => employeeTermsImportInput({ ...row, "SHIFT START": "09:00" }, employee, [split])).toThrow("cannot silently remove");
  });
  it("preserves blank fields and parses pesos without changing allowance or rest-day terms", () => {
    const input = employeeTermsImportInput(row, employee, [record]);
    expect(input.data).toMatchObject({ rate_centavos: 65050, rest_days: [0], allowances: record.data.allowances, worksite_id: record.data.worksite_id });
    expect(input.expected_source_id).toBe(record.id);
  });
  it("requires an explicit action for allowance replacement or removal", () => {
    expect(() => employeeTermsImportInput({ ...row, "ALLOWANCE NAME": "Meals" }, employee, [record])).toThrow("replace");
    expect(employeeTermsImportInput({ ...row, "ALLOWANCES ACTION": "clear", "REST DAYS": "Tue,Thu" }, employee, [record]).data).toMatchObject({ allowances: [], rest_days: [2, 4] });
    expect(() => employeeTermsImportInput({ ...row, "REST DAYS": "Monday" }, employee, [record])).toThrow("REST DAYS");
  });
  it("flags every duplicate and refuses a patch without dated terms", async () => {
    const result = await prepareEmployeeTermsImport([row, row], async () => employee, async () => [record], []);
    expect(result.every((r) => r.error?.includes("Duplicate"))).toBe(true);
    const missing = await prepareEmployeeTermsImport([row], async () => employee, async () => [], []);
    expect(missing[0].error).toContain("no active terms");
  });
  it("refuses same-date versions and malformed dates before saving", async () => {
    const existing = await prepareEmployeeTermsImport([{ ...row, "EFFECTIVE DATE": "2026-01-01" }], async () => employee, async () => [record], []);
    expect(existing[0].error).toContain("already exist");
    expect(() => employeeTermsImportInput({ ...row, "EFFECTIVE DATE": "2026-02-30" }, employee, [record])).toThrow("valid EFFECTIVE");
  });
});
