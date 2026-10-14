import { describe, expect, it } from "vitest";
import { buildAttendanceTeamPage, cutoffTeamQuery, scheduledTeamInput, type AttendanceTeamRow } from "./attendanceTeam";
import type { PayrollRun } from "../../types/payrollRun";
import { prepareWorksheetSave, teamExceptions } from "./attendanceWorksheet";
import type { PayrollRecord } from "../../types/payroll";
import type { AttendanceRecord } from "../../types/attendance";

const employee = { id: "10000000-0000-4000-8000-000000000001", employee_number: "000001", first_name: "Juan", last_name: "Dela Cruz", date_hired: "2026-01-01" };
const site = { id: "10000000-0000-4000-8000-000000000002", kind: "worksite", data: { label: "Factory", reason: "Setup" }, deleted_at: null } as PayrollRecord;
const base = { id: "10000000-0000-4000-8000-000000000003", kind: "employee_terms", data: { label: "Operator", reason: "Agreement", employee_id: employee.id, worksite_id: site.id, effective_from: "2026-01-01", shift_start: "08:00", shift_end: "17:00", break_minutes: 60, rest_days: [0], rate_centavos: 60000 }, deleted_at: null } as PayrollRecord;
const query = { date: "2026-10-12", worksiteId: site.id };
const row = () => buildAttendanceTeamPage([site, base], [employee], [], query).items[0];
describe("team attendance worksheet", () => {
  it("filters cutoff group and frequency before paging and rejects dates outside a cancelled or active run", () => {
    const run = { id: site.id, status: "draft", worksite_id: site.id, payroll_group: "A", frequency: "semi_monthly", period_start: "2026-10-01", period_end: "2026-10-15" } as PayrollRun;
    const included = { ...base, data: { ...base.data, payroll_group: "A", frequency: "semi_monthly" as const } };
    const other = { ...employee, id: "10000000-0000-4000-8000-000000000004", employee_number: "000002" };
    const excluded = { ...included, id: "10000000-0000-4000-8000-000000000005", data: { ...included.data, employee_id: other.id, payroll_group: "B" } };
    const page = buildAttendanceTeamPage([site, included, excluded], [employee, other], [], cutoffTeamQuery({ ...query, limit: 1 }, run));
    expect(page.total).toBe(1); expect(page.items[0].employeeId).toBe(employee.id);
    expect(() => cutoffTeamQuery({ ...query, date: "2026-10-16" }, run)).toThrow("active cutoff");
    expect(() => cutoffTeamQuery(query, { ...run, status: "cancelled" })).toThrow("active cutoff");
  });
  it("pages the dated team and supports comma searches in either name order", () => {
    expect(buildAttendanceTeamPage([site, base], [employee], [], { ...query, search: "Dela Cruz, Juan" }).total).toBe(1);
    expect(buildAttendanceTeamPage([site, base], [employee], [], { ...query, search: "Juan Cruz", offset: 1 }).items).toEqual([]);
    expect(buildAttendanceTeamPage([site, base], [{ ...employee, date_separated: "2026-10-01" }], [], query).total).toBe(0);
  });
  it("uses daily transfers, keeps expired latest terms blocked, and never revives older agreements", () => {
    const movedSite = { ...site, id: "10000000-0000-4000-8000-000000000004" };
    const override = { ...base, id: "10000000-0000-4000-8000-000000000005", kind: "override", data: { ...base.data, effective_from: query.date, effective_to: query.date, worksite_id: movedSite.id, rate_centavos: 65000, rest_days: [1] } } as PayrollRecord;
    const setup = [site, movedSite, base, override];
    expect(buildAttendanceTeamPage(setup, [employee], [], query).total).toBe(0);
    const moved = buildAttendanceTeamPage(setup, [employee], [], { ...query, worksiteId: movedSite.id }).items[0];
    expect(moved.restDay).toBe(true);
    expect(teamExceptions(moved, null)).toEqual(expect.arrayContaining(["Rate changed", "Schedule changed", "Duty changed", "Unrecorded"]));
    const expired = { ...base, id: override.id, data: { ...base.data, effective_from: "2026-10-01", effective_to: "2026-10-10" } };
    expect(buildAttendanceTeamPage([site, base, expired], [employee], [], query).items[0].terms).toBeNull();
  });
  it("applies overnight defaults and records scheduled rest days without punches", () => {
    const overnight: AttendanceTeamRow = { ...row(), terms: { ...base, data: { ...base.data, shift_start: "22:00", shift_end: "06:00" } } };
    expect(scheduledTeamInput(overnight, "Verified log").segments[0].out_next_day).toBe(true);
    expect(scheduledTeamInput({ ...overnight, restDay: true }, "Verified log")).toMatchObject({ status: "rest_day", segments: [] });
  });
  it("saves only selected edits and requires a reference and current draft identity", () => {
    const r = row(), input = scheduledTeamInput(r, "");
    expect(() => prepareWorksheetSave([r], { [employee.id]: input }, new Set([employee.id]), "")).toThrow("reference");
    expect(() => prepareWorksheetSave([r], { [employee.id]: input }, new Set(), "Verified log")).toThrow("changed rows");
    expect(prepareWorksheetSave([r], { [employee.id]: input }, new Set([employee.id]), "Verified log")[0].reason).toBe("Verified log");
    const concurrent = { ...r, attendance: { id: base.id, review_status: "draft" } as AttendanceRecord };
    expect(() => prepareWorksheetSave([concurrent], { [employee.id]: input }, new Set([employee.id]), "Verified log")).toThrow("draft or pay terms changed");
    expect(() => scheduledTeamInput({ ...r, attendance: { review_status: "approved" } as AttendanceRecord }, "Log")).toThrow("unlocked");
  });
  it("flags missing punches and blocks adjacent-day overlap before saving", () => {
    const r = row(), input = scheduledTeamInput(r, "");
    input.segments[0].time_out = "";
    expect(teamExceptions(r, input).some((flag) => flag.includes("punch times"))).toBe(true);
    const adjacent = { ...r, neighbors: [{ employee_id: employee.id, work_date: "2026-10-11", segments: [{ time_in: "22:00", time_out: "09:00", in_next_day: false, out_next_day: true, break_minutes: 0 }] } as AttendanceRecord] };
    expect(() => prepareWorksheetSave([adjacent], { [employee.id]: scheduledTeamInput(r, "") }, new Set([employee.id]), "Log")).toThrow("adjacent");
  });
});
