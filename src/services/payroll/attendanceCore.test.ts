import { describe, expect, it } from "vitest";
import type { AttendanceInput, AttendanceRecord } from "../../types/attendance";
import { attendanceMetrics, attendanceMinutes, validateAttendanceInput, validateAttendanceRecords } from "./attendanceCore";
const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const input: AttendanceInput = { employee_id: id(1), employee_label: "000001 - Dela Cruz, Juan", work_date: "2026-10-12", status: "present", terms_id: id(2), reason: "Daily attendance", segments: [{ time_in: "22:00", time_out: "07:00", in_next_day: false, out_next_day: true, break_minutes: 60 }] };
const snapshot = { label: "Night duty", reason: "Agreement", employee_id: id(1), shift_start: "22:00", shift_end: "07:00", break_minutes: 60, rate_centavos: 60000 };
function record(n: number, values = input): AttendanceRecord { return { ...values, id: id(n), terms_snapshot: snapshot, review_status: "draft", reviewed_by: null, reviewed_at: null, supersedes_id: null, created_by: id(9), created_at: "2026-10-12", updated_at: "2026-10-12", deleted_at: null }; }
describe("daily attendance geometry", () => {
  it("handles overnight shifts and calculates raw worked, late and early minutes", () => {
    expect(() => validateAttendanceInput(input)).not.toThrow();
    expect(attendanceMinutes(input)).toBe(480);
    expect(attendanceMetrics(input, snapshot)).toEqual({ worked: 480, scheduled: 480, late: 0, earlyDeparture: 0 });
    expect(attendanceMetrics({ ...input, segments: [{ ...input.segments[0], time_in: "22:15", time_out: "06:30" }] }, snapshot)).toMatchObject({ worked: 435, late: 15, earlyDeparture: 30 });
  });
  it("accepts separate contiguous segments but rejects overlaps and invalid overnight flags", () => {
    const day = { ...input, segments: [{ time_in: "08:00", time_out: "12:00", in_next_day: false, out_next_day: false, break_minutes: 0 }, { time_in: "12:00", time_out: "17:00", in_next_day: false, out_next_day: false, break_minutes: 60 }] };
    expect(() => validateAttendanceInput(day)).not.toThrow();
    expect(attendanceMinutes(day)).toBe(480);
    expect(() => validateAttendanceInput({ ...day, segments: [day.segments[0], { ...day.segments[1], time_in: "11:59" }] })).toThrow("overlap");
    expect(() => validateAttendanceInput({ ...input, segments: [{ ...input.segments[0], out_next_day: false }] })).toThrow("follow time in");
  });
  it("rejects duplicate days and overnight collisions across adjacent dates", () => {
    expect(() => validateAttendanceRecords([record(3), record(4)])).toThrow("already exists");
    const tomorrow = record(4, { ...input, work_date: "2026-10-13", segments: [{ time_in: "06:00", time_out: "14:00", in_next_day: false, out_next_day: false, break_minutes: 0 }] });
    expect(() => validateAttendanceRecords([record(3), tomorrow])).toThrow("another work date");
    tomorrow.segments[0].time_in = "07:00";
    expect(() => validateAttendanceRecords([record(3), tomorrow])).not.toThrow();
  });
  it("requires no punches for leave/absence and validates approval metadata", () => {
    expect(() => validateAttendanceInput({ ...input, status: "absent" })).toThrow("non-working");
    expect(() => validateAttendanceInput({ ...input, status: "paid_leave", segments: [] })).not.toThrow();
    expect(() => validateAttendanceRecords([{ ...record(3), review_status: "approved" }])).toThrow("approval metadata");
    expect(() => validateAttendanceRecords([{ ...record(3), review_status: "approved", reviewed_by: id(9), reviewed_at: "2026-10-14T00:00:00Z" }])).not.toThrow();
  });
});
