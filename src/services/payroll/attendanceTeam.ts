import type { AttendanceInput, AttendanceRecord } from "../../types/attendance";
import type { PayrollRecord } from "../../types/payroll";
import type { PayrollRun } from "../../types/payrollRun";
import { scheduledSegments } from "./payrollSchedule";

export type AttendanceTeamQuery = { date: string; worksiteId: string; runId?: string; payrollGroup?: string; frequency?: string; departmentId?: string; search?: string; limit?: number; offset?: number };
export function cutoffTeamQuery(q: AttendanceTeamQuery, run?: PayrollRun): AttendanceTeamQuery {
  if (!run || run.status !== "draft" || q.worksiteId !== run.worksite_id || q.date < run.period_start || q.date > run.period_end) throw new Error("Select a date and worksite within the active cutoff.");
  return { ...q, payrollGroup: run.payroll_group, frequency: run.frequency };
}
export type AttendanceTeamRow = { employeeId: string; employeeLabel: string; date: string; terms: PayrollRecord | null; baseTerms: PayrollRecord | null; attendance: AttendanceRecord | null; neighbors: AttendanceRecord[]; restDay: boolean };
export type AttendanceTeamPage = { items: AttendanceTeamRow[]; total: number };
type TeamEmployee = { id: string; employee_number: string; first_name: string; last_name: string; middle_name?: string | null; date_hired?: string | null; date_separated?: string | null; deleted_at?: string | null };

export function validateTeamQuery(q: AttendanceTeamQuery) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(q.date) || !Number.isFinite(Date.parse(q.date)) || new Date(q.date).toISOString().slice(0, 10) !== q.date) throw new Error("Select a valid attendance date.");
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuid.test(q.worksiteId) || q.departmentId && !uuid.test(q.departmentId)) throw new Error("Select a worksite and a valid department.");
  if (q.limit !== undefined && (!Number.isInteger(q.limit) || q.limit < 1 || q.limit > 100) || q.offset !== undefined && (!Number.isInteger(q.offset) || q.offset < 0)) throw new Error("Invalid worksheet page.");
}

// Used by offline storage and the embedded LAN server; cloud paging is implemented in SQL.
export function buildAttendanceTeamPage(setup: PayrollRecord[], employees: TeamEmployee[], attendance: AttendanceRecord[], q: AttendanceTeamQuery): AttendanceTeamPage {
  validateTeamQuery(q);
  const bases = new Map<string, PayrollRecord>(), overrides = new Map<string, PayrollRecord>();
  for (const r of setup) {
    if (r.deleted_at || !r.data.employee_id || !r.data.effective_from || r.data.effective_from > q.date) continue;
    const map = r.kind === "employee_terms" ? bases : r.kind === "override" && r.data.effective_from === q.date ? overrides : null;
    if (map && (!map.has(r.data.employee_id) || map.get(r.data.employee_id)!.data.effective_from! < r.data.effective_from)) map.set(r.data.employee_id, r);
  }
  const sites = new Set(setup.filter((r) => r.kind === "worksite" && !r.deleted_at).map((r) => r.id));
  const records = new Map<string, AttendanceRecord[]>();
  for (const r of attendance) {
    if (r.deleted_at || Math.abs(Date.parse(r.work_date) - Date.parse(q.date)) > 86400000) continue;
    records.set(r.employee_id, [...(records.get(r.employee_id) || []), r]);
  }
  const search = (q.search || "").toLowerCase().split(/[\s,]+/).filter(Boolean), items: AttendanceTeamRow[] = [];
  for (const e of employees) {
    if (e.deleted_at || e.date_hired && e.date_hired > q.date || e.date_separated && e.date_separated < q.date) continue;
    const base = bases.get(e.id) || null, candidate = overrides.get(e.id) || base;
    if (!candidate || candidate.data.worksite_id !== q.worksiteId || q.departmentId && candidate.data.department_id !== q.departmentId) continue;
    if (q.payrollGroup && candidate.data.payroll_group !== q.payrollGroup || q.frequency && candidate.data.frequency !== q.frequency) continue;
    const employeeLabel = `${e.employee_number} - ${e.last_name}, ${e.first_name}${e.middle_name ? ` ${e.middle_name}` : ""}`;
    if (!search.every((term) => employeeLabel.toLowerCase().includes(term))) continue;
    const terms = sites.has(q.worksiteId) && (!candidate.data.effective_to || candidate.data.effective_to >= q.date) ? candidate : null;
    const related = records.get(e.id) || [];
    items.push({ employeeId: e.id, employeeLabel, date: q.date, baseTerms: base, terms, attendance: related.find((r) => r.work_date === q.date) || null, neighbors: related.filter((r) => r.work_date !== q.date), restDay: Boolean(terms?.data.rest_days?.includes(new Date(`${q.date}T00:00:00Z`).getUTCDay())) });
  }
  items.sort((a, b) => a.employeeLabel.localeCompare(b.employeeLabel) || a.employeeId.localeCompare(b.employeeId));
  return { items: items.slice(q.offset || 0, (q.offset || 0) + (q.limit || 25)), total: items.length };
}

export function scheduledTeamInput(row: AttendanceTeamRow, reason: string): AttendanceInput {
  if (!row.terms || row.attendance?.review_status === "approved") throw new Error("Applicable terms and an unlocked attendance record are required.");
  const d = row.terms.data;
  return { employee_id: row.employeeId, employee_label: row.employeeLabel, work_date: row.date, status: row.restDay ? "rest_day" : "present", segments: row.restDay ? [] : scheduledSegments(d), reason, terms_id: row.terms.id, replace_id: row.attendance?.id || null };
}
