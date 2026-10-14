import type { AttendanceInput, AttendanceRecord, AttendanceSegment } from "../../types/attendance";
import type { PayrollData } from "../../types/payroll";
import { scheduledSegments, dutyRange } from "./payrollSchedule";
export const attendanceStorageKey = "coop_sys_attendance";
export const attendanceStatuses = ["present", "absent", "paid_leave", "unpaid_leave", "rest_day", "awol"] as const;
export function attendanceLabel(status: string) { return status === "awol" ? "AWOL / AWOP" : status === "rest_day" ? "Day-off" : status.replaceAll("_", " "); }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const clock = /^([01]\d|2[0-3]):[0-5]\d$/;
export function attendanceDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value; }
export function clockMinutes(value: string) { return Number(value.slice(0, 2)) * 60 + Number(value.slice(3)); }
export function segmentRange(s: AttendanceSegment) { return { start: clockMinutes(s.time_in) + (s.in_next_day ? 1440 : 0), end: clockMinutes(s.time_out) + (s.out_next_day ? 1440 : 0) }; }
export function attendanceInputsOverlap(a: AttendanceInput, b: AttendanceInput) {
  if (a.employee_id !== b.employee_id) return false;
  const offset = (Date.parse(`${b.work_date}T00:00:00Z`) - Date.parse(`${a.work_date}T00:00:00Z`)) / 60000;
  return a.segments.some((left) => b.segments.some((right) => {
    const l = segmentRange(left), r = segmentRange(right);
    return l.start < offset + r.end && l.end > offset + r.start;
  }));
}
export function validateAttendanceInput(input: AttendanceInput) {
  if (!uuid.test(input.employee_id) || !uuid.test(input.terms_id) || input.replace_id && !uuid.test(input.replace_id)) throw new Error("Select a valid employee and dated pay terms.");
  if (!attendanceDate(input.work_date)) throw new Error("Enter a valid work date.");
  if (!attendanceStatuses.includes(input.status)) throw new Error("Select an attendance status.");
  if (!input.reason?.trim() || input.reason.length > 1000) throw new Error("A reason or attendance reference is required (maximum 1,000 characters).");
  if (!input.employee_label?.trim() || input.employee_label.length > 300 || input.source_file && input.source_file.length > 255) throw new Error("Employee label or source filename is invalid.");
  if (!Array.isArray(input.segments) || input.segments.length > 12 || (input.status === "present" ? !input.segments.length : Boolean(input.segments.length))) throw new Error("Present records require 1–12 work segments; non-working statuses cannot contain punches.");
  const ranges: { start: number; end: number }[] = [];
  for (const s of input.segments) {
    if (!clock.test(s.time_in) || !clock.test(s.time_out) || typeof s.in_next_day !== "boolean" || typeof s.out_next_day !== "boolean") throw new Error("Enter valid 24-hour punch times and next-day flags.");
    const r = segmentRange(s), duration = r.end - r.start;
    if (duration <= 0 || duration > 1440) throw new Error("Time out must follow time in, with a segment no longer than 24 hours.");
    if (!Number.isInteger(s.break_minutes) || s.break_minutes < 0 || s.break_minutes >= duration) throw new Error("Unpaid break must be shorter than the work segment.");
    if (ranges.some((previous) => r.start < previous.end && r.end > previous.start)) throw new Error("Work segments overlap.");
    ranges.push(r);
  }
}
export function validateAttendanceRecords(records: AttendanceRecord[]) {
  const ids = new Set<string>(), days = new Set<string>();
  const ranges = new Map<string, { start: number; end: number }[]>();
  for (const r of records) {
    if (!uuid.test(r.id) || ids.has(r.id)) throw new Error("Invalid or duplicate attendance record ID.");
    ids.add(r.id);
    if (r.deleted_at) continue;
    validateAttendanceInput(r);
    if (!["draft", "approved"].includes(r.review_status)) throw new Error("Invalid attendance review status.");
    if (r.approval_mode && !["manual", "automatic"].includes(r.approval_mode)) throw new Error("Invalid attendance review mode.");
    if (r.review_status === "approved" && (r.approval_mode !== "automatic" && !uuid.test(r.reviewed_by || "") || !r.reviewed_at || !Number.isFinite(Date.parse(r.reviewed_at))) || r.review_status === "draft" && (r.reviewed_by || r.reviewed_at)) throw new Error("Invalid attendance approval metadata.");
    if (r.payroll_posted_at && (!Number.isFinite(Date.parse(r.payroll_posted_at)) || !uuid.test(r.payroll_run_id || "") || r.review_status !== "approved")) throw new Error("Invalid payroll posting lock.");
    const snapshot = r.terms_snapshot;
    if (!snapshot || snapshot.employee_id !== r.employee_id || !clock.test(snapshot.shift_start || "") || !clock.test(snapshot.shift_end || "") || !Number.isInteger(snapshot.break_minutes) || !Number.isSafeInteger(snapshot.rate_centavos) || Number(snapshot.rate_centavos) <= 0) throw new Error("Invalid attendance pay-term snapshot.");
    const key = `${r.employee_id}:${r.work_date}`;
    if (days.has(key)) throw new Error("Attendance already exists for this employee and work date.");
    days.add(key);
    const employeeRanges = ranges.get(r.employee_id) || [];
    const midnight = Date.parse(`${r.work_date}T00:00:00Z`) / 60000;
    for (const s of r.segments) {
      const range = segmentRange(s), start = midnight + range.start, end = midnight + range.end;
      if (employeeRanges.some((p) => start < p.end && end > p.start)) throw new Error("Attendance overlaps another work date for this employee.");
      employeeRanges.push({ start, end });
    }
    ranges.set(r.employee_id, employeeRanges);
  }
}
export function attendanceMinutes(input: Pick<AttendanceInput, "segments">) { return input.segments.reduce((sum, s) => { const r = segmentRange(s); return sum + r.end - r.start - s.break_minutes; }, 0); }
export function attendanceMetrics(input: Pick<AttendanceInput, "segments" | "status">, terms: PayrollData) {
  const start = clockMinutes(terms.shift_start!), end = clockMinutes(terms.shift_end!) + (terms.shift_end! <= terms.shift_start! ? 1440 : 0);
  const scheduled = end - start - terms.break_minutes!;
  const segments = input.segments.map(segmentRange).sort((a, b) => a.start - b.start);
  let late = 0, earlyDeparture = 0;
  if (input.status === "present" && segments.length) {
    if (terms.duty_segments) for (const duty of scheduledSegments(terms)) {
      const d = dutyRange(duty), overlaps = segments.filter((s) => s.start < d.end && s.end > d.start);
      if (!overlaps.length) earlyDeparture += d.end - d.start - duty.break_minutes;
      else { late += Math.max(0, Math.min(...overlaps.map((s) => s.start)) - d.start); earlyDeparture += Math.max(0, d.end - Math.max(...overlaps.map((s) => s.end))); }
    } else { late = Math.max(0, segments[0].start - start); earlyDeparture = Math.max(0, end - segments.at(-1)!.end); }
  }
  return { worked: attendanceMinutes(input), scheduled, late, earlyDeparture };
}
