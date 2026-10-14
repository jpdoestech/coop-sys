import { describe, expect, it } from "vitest";
import { dutySummary, scheduledSegments, validateDutySchedule } from "./payrollSchedule";
import { attendanceMetrics } from "./attendanceCore";
const duties = [{ time_in: "08:00", time_out: "12:00", in_next_day: false, out_next_day: false, break_minutes: 0 }, { time_in: "13:00", time_out: "17:00", in_next_day: false, out_next_day: false, break_minutes: 0 }];
describe("split duty schedules", () => {
  it("derives the outer shift and lunch gap without deducting lunch twice", () => {
    expect(dutySummary(duties)).toEqual({ shift_start: "08:00", shift_end: "17:00", break_minutes: 60 });
    const terms = { label: "Terms", reason: "Agreement", ...dutySummary(duties), duty_segments: duties };
    validateDutySchedule(terms);
    expect(attendanceMetrics({ status: "present", segments: scheduledSegments(terms) }, terms)).toEqual({ worked: 480, scheduled: 480, late: 0, earlyDeparture: 0 });
  });
  it("counts afternoon lateness and morning undertime independently", () => {
    const terms = { label: "Terms", reason: "Agreement", ...dutySummary(duties), duty_segments: duties };
    const actual = [{ ...duties[0], time_out: "11:30" }, { ...duties[1], time_in: "13:20" }];
    expect(attendanceMetrics({ status: "present", segments: actual }, terms)).toEqual({ worked: 430, scheduled: 480, late: 20, earlyDeparture: 30 });
    expect(attendanceMetrics({ status: "present", segments: [duties[0]] }, terms).worked).toBe(240);
  });
  it("preserves legacy shifts and rejects overlapping or mismatched segment summaries", () => {
    expect(scheduledSegments({ label: "Night", reason: "Agreement", shift_start: "22:00", shift_end: "06:00", break_minutes: 60 })[0].out_next_day).toBe(true);
    expect(() => dutySummary([duties[0], { ...duties[1], time_in: "11:00" }])).toThrow("chronological");
    expect(() => validateDutySchedule({ label: "Terms", reason: "Agreement", shift_start: "08:00", shift_end: "17:00", break_minutes: 0, duty_segments: duties })).toThrow("do not match");
  });
});
