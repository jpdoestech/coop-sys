import type { AttendanceInput, AttendanceRecord, AttendanceStatus } from "../../types/attendance";
import type { PayrollRecord } from "../../types/payroll";
import type { PayrollRun } from "../../types/payrollRun";
import type { CalculationSource } from "../../types/payrollCalculation";
import type { AttendanceTeamRow } from "./attendanceTeam";
import type { AttendanceBlankMode } from "./attendancePreferences";
import { attendanceInputsOverlap, attendanceMetrics, validateAttendanceInput, validateAttendanceRecords } from "./attendanceCore";
import { scheduledSegments } from "./payrollSchedule";
import { resolvePayrollWorkDate, validatePayrollRecords } from "./payrollSetup";
import { runDates } from "./payrollRuns";
export type MatrixEmployee = { id: string; label: string; days: Record<string, AttendanceTeamRow> };
export function matrixKey(employeeId: string, date: string) { return `${employeeId}:${date}`; }
export function matrixEmployees(source: CalculationSource) {
  const employees = new Map<string, MatrixEmployee>();
  for (const row of source.rows) {
    const candidate = row.terms || row.baseTerms;
    if (!candidate || candidate.data.worksite_id !== source.run.worksite_id || candidate.data.frequency !== source.run.frequency || candidate.data.payroll_group?.trim().toLowerCase() !== source.run.payroll_group.trim().toLowerCase()) continue;
    const employee = employees.get(row.employeeId) || { id: row.employeeId, label: row.employeeLabel, days: {} };
    employee.days[row.date] = row; employees.set(row.employeeId, employee);
  }
  return [...employees.values()].sort((a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id));
}
export function matrixEditable(row?: AttendanceTeamRow) { return Boolean(row?.terms && row.attendance?.review_status !== "approved"); }
export function matrixInput(row: AttendanceTeamRow, status: AttendanceStatus): AttendanceInput {
  if (!matrixEditable(row)) throw new Error("This assignment-day is unavailable or approved attendance is locked.");
  return { employee_id: row.employeeId, employee_label: row.employeeLabel, work_date: row.date, status,
    terms_id: row.terms!.id, replace_id: row.attendance?.id || null, reason: "",
    segments: status === "present" ? scheduledSegments(row.terms!.data) : [] };
}
export function matrixTimeInputs(rows: AttendanceTeamRow[], segments: AttendanceInput["segments"], reason: string) {
  if (!rows.length || !matrixEditable(rows[0])) throw new Error("Select editable attendance dates first.");
  const duty = JSON.stringify(scheduledSegments(rows[0].terms!.data));
  return rows.map((row) => {
    if (!matrixEditable(row) || JSON.stringify(scheduledSegments(row.terms!.data)) !== duty) throw new Error("Select dates with the same duty schedule for a bulk time adjustment.");
    const input = { ...matrixInput(row, "present"), segments: structuredClone(segments), reason };
    validateAttendanceInput({ ...input, reason: reason || "Matrix time adjustment" });
    return input;
  });
}
export function matrixDefault(row: AttendanceTeamRow, mode: AttendanceBlankMode, dayType?: string) {
  if (!row.terms || row.attendance) return null;
  if (row.restDay) return "rest_day" as const;
  if (dayType && dayType !== "ordinary") return null;
  return mode;
}
export function matrixSummary(employee: MatrixEmployee, edits: Record<string, AttendanceInput>, mode: AttendanceBlankMode, calendar: Record<string, string>) {
  const summary = { absent: 0, restDay: 0, leave: 0, awol: 0, presentDays: 0, late: 0, undertime: 0, unconfirmed: 0 };
  for (const row of Object.values(employee.days)) {
    const input = edits[matrixKey(row.employeeId, row.date)] || row.attendance;
    const assumed = matrixDefault(row, mode, calendar[row.date]);
    const status = input?.status || assumed;
    if (!input && assumed) summary.unconfirmed++;
    if (status === "present" && row.terms) {
      const metrics = attendanceMetrics(input || { status: "present", segments: scheduledSegments(row.terms.data) }, row.terms.data);
      summary.presentDays += Math.min(1, metrics.worked / metrics.scheduled);
      summary.late += metrics.late; summary.undertime += metrics.earlyDeparture;
    } else if (status === "absent") summary.absent++;
    else if (status === "rest_day") summary.restDay++;
    else if (status === "awol") summary.awol++;
    else if (status === "paid_leave" || status === "unpaid_leave") summary.leave++;
  }
  return summary;
}
export function prepareMatrixSave(rows: AttendanceTeamRow[], edits: Record<string, AttendanceInput>, reference: string) {
  if (!reference.trim() || reference.length > 1000) throw new Error("Enter the DTR / attendance reference (maximum 1,000 characters).");
  const days = new Map(rows.map((r) => [matrixKey(r.employeeId, r.date), r]));
  const inputs = Object.entries(edits).map(([key, edit]) => {
    const row = days.get(key);
    if (!matrixEditable(row) || !row || edit.terms_id !== row.terms!.id || (edit.replace_id || null) !== (row.attendance?.id || null)) throw new Error("Attendance or pay terms changed. Reload and review the affected dates.");
    const input = { ...edit, reason: edit.reason.trim() || reference.trim() };
    validateAttendanceInput(input); return input;
  });
  if (!inputs.length || inputs.length > 3100) throw new Error("Save between 1 and 3,100 assignment-days.");
  const replacements = new Set(inputs.map((r) => r.replace_id));
  const existing = [...new Map(rows.flatMap((r) => [...(r.attendance ? [r.attendance] : []), ...r.neighbors]).map((r) => [r.id, r])).values()].filter((r) => !r.deleted_at && !replacements.has(r.id));
  const grouped = new Map<string, AttendanceInput[]>();
  for (const input of inputs) {
    const peers = grouped.get(input.employee_id) || [];
    if (peers.some((r) => attendanceInputsOverlap(input, r)) || existing.some((r) => attendanceInputsOverlap(input, r))) throw new Error(`${input.employee_label}: work segments overlap another date.`);
    peers.push(input); grouped.set(input.employee_id, peers);
  }
  return inputs;
}
type AttendanceEmployee = { id: string; employee_number: string; first_name: string; last_name: string; date_hired?: string | null; date_separated?: string | null; deleted_at?: string | null };
export function cutoffAttendanceRevisions(run: PayrollRun, inputs: AttendanceInput[], records: AttendanceRecord[], setup: PayrollRecord[], employees: AttendanceEmployee[], actor: string, stamp: string, uuid: () => string) {
  const dates = new Set(runDates(run));
  if (run.status !== "draft" || !Array.isArray(inputs) || !inputs.length || inputs.length > 3100 || new Set(inputs.map((r) => r.employee_id)).size > 100) throw new Error("Select an active cutoff and at most 100 employees / 3,100 assignment-days.");
  const next = structuredClone(records), nextSetup = structuredClone(setup), seen = new Set<string>();
  const employeeMap = new Map(employees.filter((e) => !e.deleted_at).map((e) => [e.id, e]));
  for (const input of inputs) {
    validateAttendanceInput(input);
    const key = matrixKey(input.employee_id, input.work_date);
    if (!dates.has(input.work_date) || seen.has(key)) throw new Error("Duplicate attendance or a date outside this cutoff.");
    seen.add(key);
    const employee = employeeMap.get(input.employee_id);
    if (!employee || employee.date_hired && input.work_date < employee.date_hired || employee.date_separated && input.work_date > employee.date_separated) throw new Error("Attendance date is outside the employment period.");
    const resolved = resolvePayrollWorkDate(nextSetup, employee.id, input.work_date);
    let terms = resolved.terms;
    if (!terms || terms.id !== input.terms_id || terms.data.worksite_id !== run.worksite_id || terms.data.frequency !== run.frequency || terms.data.payroll_group?.trim().toLowerCase() !== run.payroll_group.trim().toLowerCase()) throw new Error("Pay terms changed or do not match this cutoff.");
    if (input.status === "rest_day" && !resolved.restDay) {
      if (terms.kind === "override") throw new Error("An existing daily override must be corrected before changing its day-off.");
      terms = { id: uuid(), kind: "override", created_by: actor, created_at: stamp, updated_at: stamp, deleted_at: null, data: { ...structuredClone(terms.data), label: `${employee.employee_number} - Day-off override`, reason: input.reason, effective_from: input.work_date, effective_to: input.work_date, source_terms_id: terms.id, rest_days: [...new Set([...(terms.data.rest_days || []), new Date(`${input.work_date}T00:00:00Z`).getUTCDay()])].sort() } };
      nextSetup.push(terms);
    }
    const previous = next.find((r) => !r.deleted_at && r.employee_id === employee.id && r.work_date === input.work_date);
    if (previous?.review_status === "approved" || (previous?.id || null) !== (input.replace_id || null)) throw new Error("Only the current draft for the same employee/date can be corrected.");
    if (previous) { previous.deleted_at = stamp; previous.updated_at = stamp; }
    const { replace_id, ...values } = input;
    next.push({ ...structuredClone(values), terms_id: terms.id, terms_snapshot: structuredClone(terms.data), employee_label: `${employee.employee_number} - ${employee.last_name}, ${employee.first_name}`, id: uuid(), created_by: actor, created_at: stamp, updated_at: stamp, deleted_at: null, review_status: "draft", reviewed_by: null, reviewed_at: null, supersedes_id: replace_id || null });
  }
  validatePayrollRecords(nextSetup); validateAttendanceRecords(next);
  return { attendance: next, setup: nextSetup };
}
