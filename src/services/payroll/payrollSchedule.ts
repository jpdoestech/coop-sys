import type { PayrollData, PayrollDutySegment } from "../../types/payroll";
const clock = /^([01]\d|2[0-3]):[0-5]\d$/;
const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
export function dutyRange(s: PayrollDutySegment) { return { start: minutes(s.time_in) + (s.in_next_day ? 1440 : 0), end: minutes(s.time_out) + (s.out_next_day ? 1440 : 0) }; }
export function dutySummary(segments: PayrollDutySegment[]) {
  if (!Array.isArray(segments) || !segments.length || segments.length > 12) throw new Error("Set between 1 and 12 duty segments.");
  let paid = 0, previousEnd = -1;
  for (const s of segments) {
    if (!clock.test(s.time_in) || !clock.test(s.time_out) || typeof s.in_next_day !== "boolean" || typeof s.out_next_day !== "boolean") throw new Error("Duty segments require valid times and next-day flags.");
    const r = dutyRange(s), duration = r.end - r.start;
    if (duration <= 0 || r.start < previousEnd || !Number.isInteger(s.break_minutes) || s.break_minutes < 0 || s.break_minutes >= duration) throw new Error("Duty segments must be chronological, non-overlapping, with valid breaks.");
    paid += duration - s.break_minutes; previousEnd = r.end;
  }
  const first = segments[0], last = segments.at(-1)!, span = dutyRange(last).end - dutyRange(first).start;
  if (first.in_next_day || span > 1440 || span <= 0 || last.time_out === first.time_in) throw new Error("The first duty starts on the work date and the schedule must be shorter than 24 hours.");
  return { shift_start: first.time_in, shift_end: last.time_out, break_minutes: span - paid };
}
export function scheduledSegments(data: PayrollData): PayrollDutySegment[] {
  return data.duty_segments ? structuredClone(data.duty_segments) : [{ time_in: data.shift_start!, time_out: data.shift_end!, in_next_day: false, out_next_day: data.shift_end! <= data.shift_start!, break_minutes: data.break_minutes! }];
}
export function validateDutySchedule(data: PayrollData) {
  if (data.duty_segments === undefined) return;
  const summary = dutySummary(data.duty_segments);
  if (summary.shift_start !== data.shift_start || summary.shift_end !== data.shift_end || summary.break_minutes !== data.break_minutes) throw new Error("Duty segments do not match the shift and unpaid-break summary.");
}
