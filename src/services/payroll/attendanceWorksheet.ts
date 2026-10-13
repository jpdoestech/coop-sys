import type { AttendanceInput } from "../../types/attendance";
import type { AttendanceTeamRow } from "./attendanceTeam";
import { attendanceInputsOverlap, attendanceMetrics, validateAttendanceInput } from "./attendanceCore";

export function teamInput(row: AttendanceTeamRow): AttendanceInput | null {
  if (!row.attendance) return null;
  const r = row.attendance;
  return { employee_id: row.employeeId, employee_label: row.employeeLabel, work_date: row.date, status: r.status, segments: structuredClone(r.segments), reason: "", terms_id: row.terms?.id || r.terms_id, replace_id: r.id };
}

export function teamExceptions(row: AttendanceTeamRow, input: AttendanceInput | null): string[] {
  const flags: string[] = [];
  if (!row.terms) flags.push("Missing / expired terms");
  if (!input) flags.push("Unrecorded");
  if (row.attendance && row.terms && row.attendance.terms_id !== row.terms.id) flags.push("Terms changed");
  if (row.terms?.kind === "override") {
    flags.push("Daily override");
    const base = row.baseTerms?.data, current = row.terms.data;
    if (base && (current.rate_centavos !== base.rate_centavos || current.monthly_factor !== base.monthly_factor || current.pay_basis !== base.pay_basis)) flags.push("Rate changed");
    if (base && (JSON.stringify(base.rest_days) !== JSON.stringify(current.rest_days) || base.shift_start !== current.shift_start || base.shift_end !== current.shift_end)) flags.push("Schedule changed");
    if (base && (base.position_id !== current.position_id || base.department_id !== current.department_id || base.worksite_id !== current.worksite_id)) flags.push("Duty changed");
  } else if (row.terms?.data.effective_from === row.date) flags.push("Terms effective today");
  if (input) {
    if (input.status === "absent") flags.push("Absent");
    if (["paid_leave", "unpaid_leave"].includes(input.status)) flags.push("Leave");
    if (input.status === "present" && row.restDay) flags.push("Rest-day work");
    if (input.segments.length > 1) flags.push("Multiple segments");
    try { validateAttendanceInput({ ...input, reason: "Worksheet validation" }); } catch (error) { flags.push((error as Error).message); }
    if (row.neighbors.some((r) => attendanceInputsOverlap(input, r))) flags.push("Adjacent-day overlap");
    if (row.terms && input.status === "present" && input.segments.every((s) => s.time_in && s.time_out)) {
      const metrics = attendanceMetrics(input, row.terms.data);
      if (metrics.late) flags.push(`Late ${metrics.late} min`);
      if (metrics.earlyDeparture) flags.push(`Early ${metrics.earlyDeparture} min`);
    }
  }
  return flags;
}

export function prepareWorksheetSave(rows: AttendanceTeamRow[], edits: Record<string, AttendanceInput>, selected: Set<string>, reference: string) {
  if (!reference.trim()) throw new Error("Enter an attendance / correction reference before saving.");
  const inputs: AttendanceInput[] = [];
  for (const row of rows) {
    const edit = edits[row.employeeId];
    if (!selected.has(row.employeeId) || !edit) continue;
    if (!row.terms || row.attendance?.review_status === "approved") throw new Error(`${row.employeeLabel}: attendance is locked or pay terms are missing.`);
    if ((edit.replace_id || null) !== (row.attendance?.id || null) || edit.terms_id !== row.terms.id) throw new Error(`${row.employeeLabel}: the draft or pay terms changed. Reload and review the row.`);
    const input = { ...edit, reason: reference.trim(), terms_id: row.terms.id, replace_id: row.attendance?.id || null };
    try {
      validateAttendanceInput(input);
      if (input.status === "rest_day" && !row.restDay) throw new Error("Record a schedule override before marking this date as a rest day.");
      if (row.neighbors.some((r) => attendanceInputsOverlap(input, r))) throw new Error("Punches overlap an adjacent work date.");
    } catch (error) { throw new Error(`${row.employeeLabel}: ${(error as Error).message}`); }
    inputs.push(input);
  }
  if (!inputs.length) throw new Error("Select changed rows to save.");
  return inputs;
}
