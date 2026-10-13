import { describe, expect, it } from "vitest";
import { buildRunCoverage, runDates, validateRunInput, validateRunRecords } from "./payrollRuns";
import type { PayrollRun } from "../../types/payrollRun";
import type { AttendanceTeamRow } from "./attendanceTeam";
import type { PayrollRecord } from "../../types/payroll";
import type { AttendanceRecord } from "../../types/attendance";
const id = "10000000-0000-4000-8000-000000000001", employee = "10000000-0000-4000-8000-000000000002";
const run: PayrollRun = { id, title: "October first cutoff", worksite_id: id, worksite_label: "Factory", payroll_group: "Production", frequency: "semi_monthly", period_start: "2026-10-01", period_end: "2026-10-15", pay_date: "2026-10-20", reason: "Approved calendar", status: "draft", created_by: id, created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z", cancelled_by: null, cancelled_at: null, cancel_reason: null };
const terms = { id, kind: "employee_terms", data: { payroll_group: "production", frequency: "semi_monthly" } } as PayrollRecord;
const row: AttendanceTeamRow = { employeeId: employee, employeeLabel: "000001 - Dela Cruz, Juan", date: "2026-10-01", terms, baseTerms: terms, attendance: null, restDay: false, neighbors: [] };
describe("payroll preparation", () => {
  it("validates explicit period boundaries and permits flexible cutoff dates", () => {
    expect(runDates(run)).toHaveLength(15);
    expect(() => validateRunInput({ ...run, period_end: "2026-11-01", pay_date: "2026-11-05" })).toThrow("31");
    expect(() => validateRunInput({ ...run, pay_date: "2026-10-10" })).toThrow("pay date");
    expect(() => validateRunInput({ ...run, period_start: "2026-02-30" })).toThrow("valid period");
  });
  it("prevents overlapping group periods regardless of frequency and preserves cancellations", () => {
    const other = { ...run, id: employee, payroll_group: " PRODUCTION ", frequency: "monthly" as const };
    expect(() => validateRunRecords([run, other])).toThrow("overlaps");
    expect(() => validateRunRecords([run, { ...other, period_start: "2026-10-16", period_end: "2026-10-31", pay_date: "2026-11-05" }])).not.toThrow();
    expect(() => validateRunRecords([{ ...run, status: "cancelled" }])).toThrow("cancellation");
    expect(() => validateRunRecords([run, { ...other, status: "cancelled", cancelled_by: id, cancelled_at: run.created_at, cancel_reason: "Incorrect cutoff" }])).not.toThrow();
  });
  it("counts missing, draft, changed and expired days separately without claiming pay readiness", () => {
    const approved = { id, review_status: "approved", terms_id: id } as AttendanceRecord;
    const result = buildRunCoverage(run, [row, { ...row, date: "2026-10-02", attendance: { ...approved, review_status: "draft" } }, { ...row, date: "2026-10-03", attendance: { ...approved, terms_id: employee } }, { ...row, date: "2026-10-04", terms: null }]);
    expect(result.summary).toEqual({ employees: 1, expected: 4, approved: 1, missing: 2, drafts: 1, missingTerms: 1, changedTerms: 1 });
    expect(result.items[0].issues).toHaveLength(4);
    expect(result).not.toHaveProperty("netPay");
  });
  it("excludes mismatched groups and frequencies and returns full totals while paging", () => {
    const result = buildRunCoverage(run, [row, { ...row, terms: { ...terms, data: { ...terms.data, payroll_group: "Other" } } }, { ...row, terms: { ...terms, data: { ...terms.data, frequency: "monthly" } } }, { ...row, employeeId: id }], 1, 1);
    expect(result.total).toBe(2); expect(result.items).toHaveLength(1); expect(result.summary.expected).toBe(2);
    expect(() => buildRunCoverage({ ...run, status: "cancelled" }, [])).toThrow("Cancelled");
  });
});
