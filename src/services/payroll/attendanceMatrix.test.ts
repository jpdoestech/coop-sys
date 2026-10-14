import { describe, expect, it } from "vitest";
import { cutoffAttendanceRevisions, matrixDefault, matrixInput, matrixKey, matrixSummary, matrixTimeInputs, prepareMatrixSave } from "./attendanceMatrix";
import type { PayrollRun } from "../../types/payrollRun";
import type { PayrollRecord } from "../../types/payroll";
import type { AttendanceRecord } from "../../types/attendance";
import type { AttendanceTeamRow } from "./attendanceTeam";
const employee = { id: "10000000-0000-4000-8000-000000000001", employee_number: "000001", first_name: "Juan", last_name: "QA", date_hired: "2026-01-01", deleted_at: null };
const site = { id: "10000000-0000-4000-8000-000000000002", kind: "worksite", deleted_at: null, data: { label: "Factory", reason: "QA", branch_id: "10000000-0000-4000-8000-000000000003", region: "XI", province: "Davao", city: "Davao", category: "Test" } } as PayrollRecord;
const terms: PayrollRecord = { id: "10000000-0000-4000-8000-000000000004", kind: "employee_terms", created_by: employee.id, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z", deleted_at: null, data: { label: "Terms", reason: "QA", employee_id: employee.id, worksite_id: site.id, effective_from: "2026-01-01", pay_basis: "daily", rate_centavos: 60000, frequency: "semi_monthly", payroll_group: "A", shift_start: "08:00", shift_end: "17:00", break_minutes: 60, rest_days: [0], allowances: [] } };
const run = { id: "10000000-0000-4000-8000-000000000005", worksite_id: site.id, worksite_label: "Factory", title: "October cutoff", payroll_group: "A", frequency: "semi_monthly", period_start: "2026-10-01", period_end: "2026-10-15", pay_date: "2026-10-20", reason: "QA", status: "draft" } as PayrollRun;
const row: AttendanceTeamRow = { employeeId: employee.id, employeeLabel: "000001 - QA, Juan", date: "2026-10-01", terms, baseTerms: terms, attendance: null, neighbors: [], restDay: false };
let sequence = 100;
const uuid = () => `10000000-0000-4000-8000-${String(sequence++).padStart(12, "0")}`;
const stamp = "2026-10-14T01:00:00.000Z", actor = "70000000-0000-4000-8000-000000000001";
describe("cutoff attendance matrix", () => {
  it("applies identical actual times to multiple dates but never overwrites a different duty schedule", () => {
    const segments = [{ time_in: "08:30", time_out: "17:00", in_next_day: false, out_next_day: false, break_minutes: 60 }];
    const inputs = matrixTimeInputs([row, { ...row, date: "2026-10-02" }], segments, "DTR");
    expect(inputs.map((r) => r.work_date)).toEqual(["2026-10-01", "2026-10-02"]);
    expect(inputs[0].segments).not.toBe(inputs[1].segments);
    expect(() => matrixTimeInputs([row, { ...row, terms: { ...terms, data: { ...terms.data, shift_start: "07:00" } } }], segments, "DTR")).toThrow("same duty schedule");
  });
  it("keeps present/absent assumptions out of saved attendance and protects holidays and day-offs", () => {
    expect(matrixDefault(row, "present")).toBe("present"); expect(matrixDefault(row, "absent")).toBe("absent");
    expect(matrixDefault({ ...row, restDay: true }, "absent")).toBe("rest_day");
    expect(matrixDefault(row, "present", "regular_holiday")).toBeNull();
    expect(matrixDefault({ ...row, terms: null }, "present")).toBeNull();
    expect(() => prepareMatrixSave([row], {}, "DTR")).toThrow("1 and 3,100");
  });
  it("calculates half-day equivalents separately from AWOL and absence totals", () => {
    const input = matrixInput(row, "present"); input.segments = [{ time_in: "08:00", time_out: "12:00", in_next_day: false, out_next_day: false, break_minutes: 0 }];
    expect(matrixSummary({ id: employee.id, label: "Juan", days: { [row.date]: row } }, { [matrixKey(employee.id, row.date)]: input }, "absent", {})).toMatchObject({ presentDays: 0.5, absent: 0, unconfirmed: 0 });
    input.status = "awol"; input.segments = [];
    expect(matrixSummary({ id: employee.id, label: "Juan", days: { [row.date]: row } }, { [matrixKey(employee.id, row.date)]: input }, "present", {})).toMatchObject({ presentDays: 0, awol: 1, absent: 0 });
  });
  it("creates a one-day rest override and attendance together without mutating inputs", () => {
    const input = { ...matrixInput(row, "rest_day"), reason: "Client-approved day-off" };
    const next = cutoffAttendanceRevisions(run, [input], [], [site, terms], [employee], actor, stamp, uuid);
    expect(next.setup).toHaveLength(3); expect(next.setup[2].kind).toBe("override");
    expect(next.attendance[0].terms_id).toBe(next.setup[2].id); expect(next.attendance[0].status).toBe("rest_day");
    expect(input.terms_id).toBe(terms.id); expect(terms.data.rest_days).toEqual([0]);
  });
  it("rejects locked, stale, duplicate and outside-cutoff changes atomically", () => {
    const input = { ...matrixInput(row, "awol"), reason: "DTR" };
    const before = cutoffAttendanceRevisions(run, [input], [], [site, terms], [employee], actor, stamp, uuid).attendance;
    const approved = { ...before[0], review_status: "approved", reviewed_by: actor, reviewed_at: stamp } as AttendanceRecord;
    expect(() => cutoffAttendanceRevisions(run, [{ ...input, replace_id: approved.id }], [approved], [site, terms], [employee], actor, stamp, uuid)).toThrow("current draft");
    expect(() => cutoffAttendanceRevisions(run, [input, input], [], [site, terms], [employee], actor, stamp, uuid)).toThrow("Duplicate");
    expect(() => cutoffAttendanceRevisions(run, [{ ...input, work_date: "2026-10-16" }], [], [site, terms], [employee], actor, stamp, uuid)).toThrow("outside");
    expect(() => cutoffAttendanceRevisions(run, [{ ...input, terms_id: site.id }], [], [site, terms], [employee], actor, stamp, uuid)).toThrow("Pay terms changed");
    expect(approved.deleted_at).toBeNull();
  });
});
