import type { AttendanceInput, AttendanceSegment, AttendanceStatus } from "../../types/attendance";
import type { Employee } from "../../types/employee";
import type { PayrollRecord } from "../../types/payroll";
import type { PayrollRun } from "../../types/payrollRun";
import type { SpreadsheetRow } from "../imports/excelWorkbook";
import { attendanceDate, attendanceInputsOverlap, attendanceStatuses, validateAttendanceInput } from "./attendanceCore";
import { resolvePayrollWorkDate } from "./payrollSetup";

export const attendanceHeaders = ["EMPLOYEE ID", "WORK DATE", "STATUS", "TIME IN", "TIME OUT", "IN NEXT DAY", "OUT NEXT DAY", "BREAK MINUTES", "REASON"];
export type AttendanceImportResult = { rowNumbers: number[]; employeeNumber: string; date: string; input: AttendanceInput | null; error: string | null };
export function attendanceTime(value: string) {
  const text = value.trim();
  if (/^(?:0|0?\.\d+)$/.test(text)) {
    const number = Number(text) * 1440, minutes = Math.round(number);
    if (Math.abs(number - minutes) > 0.000001 || minutes >= 1440) throw new Error("Punches require whole-minute precision.");
    return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  }
  const match = text.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!match || Number(match[2]) > 59 || match[3] && match[3] !== "00") throw new Error("Use HH:mm punch times with whole-minute precision.");
  let hour = Number(match[1]);
  if (match[4]) { if (hour < 1 || hour > 12) throw new Error("Invalid 12-hour punch time."); hour = hour % 12 + (match[4].toUpperCase() === "PM" ? 12 : 0); }
  if (hour > 23) throw new Error("Invalid 24-hour punch time.");
  return `${String(hour).padStart(2, "0")}:${match[2]}`;
}
function nextDay(value = "") { if (!value || /^(NO|FALSE|0)$/i.test(value)) return false; if (/^(YES|TRUE|1)$/i.test(value)) return true; throw new Error("Next-day flags must be YES or NO."); }

export async function prepareAttendanceImport(rows: SpreadsheetRow[], fileName: string, loadEmployee: (number: string) => Promise<Employee | null>, loadTerms: (id: string, date: string) => Promise<PayrollRecord[]>, exists: (id: string, date: string, input: AttendanceInput) => Promise<boolean>, onProgress?: (done: number, total: number) => void, run?: PayrollRun): Promise<AttendanceImportResult[]> {
  if (!rows.length || rows.length > 500) throw new Error("Import between 1 and 500 worksheet rows at a time.");
  const missing = ["EMPLOYEE ID", "WORK DATE", "STATUS"].filter((header) => !(header in rows[0]));
  if (missing.length) throw new Error(`Missing headers: ${missing.join(", ")}.`);
  const groups = new Map<string, { rowNumbers: number[]; number: string; date: string; status: AttendanceStatus; segments: AttendanceSegment[]; reason: string; error: string | null }>();
  rows.forEach((row, index) => {
    const number = (row["EMPLOYEE ID"] || "").trim().padStart(6, "0"), date = row["WORK DATE"], rawStatus = (row.STATUS || "").trim().toLowerCase().replaceAll(" ", "_");
    const status = (["awop", "awol/p", "awol/awop"].includes(rawStatus) ? "awol" : rawStatus === "day-off" ? "rest_day" : rawStatus) as AttendanceStatus;
    const key = `${number}:${date}`, previous = groups.get(key);
    const group = previous || { rowNumbers: [], number, date, status, segments: [], reason: "", error: null };
    group.rowNumbers.push(index + 2); groups.set(key, group);
    try {
      if (!row["EMPLOYEE ID"]?.trim() || !/^\d{6}$/.test(number) || !attendanceDate(date || "")) throw new Error("Employee ID and a valid work date are required.");
      if (run && (run.status !== "draft" || date < run.period_start || date > run.period_end)) throw new Error("Work date is outside this active cutoff.");
      if (!attendanceStatuses.includes(status)) throw new Error("Unknown attendance status.");
      if (previous && (status !== previous.status || status !== "present")) throw new Error("Duplicate non-working record or mixed statuses for one employee/date.");
      const reason = row.REASON?.trim();
      if (!reason) throw new Error("REASON is required.");
      if (group.reason && group.reason !== reason) throw new Error("Segments for the same employee/date must share the same reason.");
      group.reason = reason;
      if (status === "present") {
        const breakText = row["BREAK MINUTES"]?.trim() || "0";
        if (!/^\d+$/.test(breakText)) throw new Error("BREAK MINUTES must be a non-negative whole number.");
        group.segments.push({ time_in: attendanceTime(row["TIME IN"] || ""), time_out: attendanceTime(row["TIME OUT"] || ""), in_next_day: nextDay(row["IN NEXT DAY"]), out_next_day: nextDay(row["OUT NEXT DAY"]), break_minutes: Number(breakText) });
      } else if (row["TIME IN"]?.trim() || row["TIME OUT"]?.trim() || Number(row["BREAK MINUTES"] || 0) !== 0 || nextDay(row["IN NEXT DAY"]) || nextDay(row["OUT NEXT DAY"])) throw new Error("Non-working statuses cannot contain punches or breaks.");
    } catch (error) { group.error = (error as Error).message; }
  });
  const results: AttendanceImportResult[] = [], entries = [...groups.values()];
  const employees = new Map<string, Promise<Employee | null>>();
  let cursor = 0, done = 0;
  async function worker() {
    while (cursor < entries.length) {
      const index = cursor++, group = entries[index];
      let input: AttendanceInput | null = null, error = group.error;
      if (!error) try {
        if (!employees.has(group.number)) employees.set(group.number, loadEmployee(group.number));
        const employee = await employees.get(group.number)!;
        if (!employee || employee.deleted_at) throw new Error("Employee ID was not found.");
        if (employee.date_hired && group.date < employee.date_hired || employee.date_separated && group.date > employee.date_separated) throw new Error("Work date is outside the employment period.");
        const resolved = resolvePayrollWorkDate(await loadTerms(employee.id, group.date), employee.id, group.date);
        if (!resolved.terms) throw new Error("No dated employee pay terms apply to this work date.");
        if (run && (resolved.terms.data.worksite_id !== run.worksite_id || resolved.terms.data.frequency !== run.frequency || resolved.terms.data.payroll_group?.trim().toLowerCase() !== run.payroll_group.trim().toLowerCase())) throw new Error("Employee assignment does not match this cutoff.");
        if (!run && group.status === "rest_day" && !resolved.restDay) throw new Error("A schedule override is required for this rest day.");
        input = { employee_id: employee.id, employee_label: `${employee.employee_number} - ${employee.last_name}, ${employee.first_name}`, work_date: group.date, status: group.status, segments: group.segments, reason: group.reason, terms_id: resolved.terms.id, source_file: fileName };
        validateAttendanceInput(input);
        if (await exists(employee.id, group.date, input)) throw new Error("Attendance already exists. Correct the draft instead of importing it again.");
      } catch (reason) { error = (reason as Error).message; input = null; }
      results[index] = { rowNumbers: group.rowNumbers, employeeNumber: group.number, date: group.date, input, error };
      onProgress?.(++done, entries.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, entries.length) }, worker));
  const conflicts = new Set<number>();
  for (let i = 0; i < results.length; i++) for (let j = i + 1; j < results.length; j++) {
    if (results[i].input && results[j].input && attendanceInputsOverlap(results[i].input!, results[j].input!)) { conflicts.add(i); conflicts.add(j); }
  }
  for (const index of conflicts) { results[index].error = "Punches overlap another work date in this workbook."; results[index].input = null; }
  return results;
}

export async function downloadAttendanceTemplate() {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook(), sheet = workbook.addWorksheet("ATTENDANCE", { views: [{ state: "frozen", ySplit: 1, xSplit: 2 }] });
  sheet.addRow(attendanceHeaders); sheet.autoFilter = { from: "A1", to: "I1" };
  attendanceHeaders.forEach((header, index) => { const column = sheet.getColumn(index + 1); column.width = header === "REASON" ? 40 : 22; column.numFmt = "@"; });
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } }; sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF247253" } };
  for (let row = 2; row <= 501; row++) {
    sheet.getCell(row, 3).dataValidation = { type: "list", allowBlank: false, formulae: ['"present,absent,paid_leave,unpaid_leave,rest_day,awol"'] };
    for (const col of [6, 7]) sheet.getCell(row, col).dataValidation = { type: "list", allowBlank: true, formulae: ['"YES,NO"'] };
  }
  sheet.getCell("A1").note = "Existing six-digit employee ID; names are not used to guess identity.";
  sheet.getCell("B1").note = "Work date: YYYY-MM-DD. Overnight punches remain attached to the shift's work date.";
  sheet.getCell("D1").note = "24-hour HH:mm. Multiple present rows with the same employee/date/reason become separate segments.";
  sheet.getCell("F1").note = "YES means the punch is on the calendar day after WORK DATE.";
  const bytes = await workbook.xlsx.writeBuffer(), url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = "attendance_daily_template.xlsx"; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
