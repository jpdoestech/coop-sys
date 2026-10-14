import type { PayrollRun, PayrollRunInput, PayrollRunQuery, RunCoverageRow, RunCoverage } from "../../types/payrollRun";
import type { AttendanceTeamRow } from "./attendanceTeam";
export const payrollRunsKey = "coop_sys_payroll_runs";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function date(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value; }
export function validateRunInput(r: PayrollRunInput) {
  if (!uuid.test(r.worksite_id)) throw new Error("Select a worksite.");
  for (const [label, value, max] of [["Run title", r.title, 200], ["Worksite label", r.worksite_label, 200], ["Payroll group", r.payroll_group, 200], ["Preparation reference", r.reason, 1000]] as const) if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error(`${label} is required (maximum ${max} characters).`);
  if (!["weekly", "semi_monthly", "monthly"].includes(r.frequency)) throw new Error("Select payroll frequency.");
  if (![r.period_start, r.period_end, r.pay_date].every(date) || r.period_end < r.period_start || r.pay_date < r.period_end) throw new Error("Enter a valid period and a pay date on or after period end.");
  if (Date.parse(r.period_end) - Date.parse(r.period_start) > 30 * 86400000) throw new Error("Preparation periods support at most 31 calendar days.");
}
export function validateRunRecords(records: PayrollRun[]) {
  const ids = new Set<string>();
  for (const r of records) {
    validateRunInput(r);
    if (!uuid.test(r.id) || ids.has(r.id) || !uuid.test(r.created_by) || !["draft", "cancelled"].includes(r.status)) throw new Error("Invalid payroll run metadata.");
    ids.add(r.id);
    if (!Number.isFinite(Date.parse(r.created_at)) || !Number.isFinite(Date.parse(r.updated_at))) throw new Error("Invalid payroll run timestamps.");
    if (r.status === "cancelled" ? !uuid.test(r.cancelled_by || "") || !r.cancelled_at || !Number.isFinite(Date.parse(r.cancelled_at)) || !r.cancel_reason?.trim() || r.cancel_reason.length > 1000 : r.cancelled_by || r.cancelled_at || r.cancel_reason) throw new Error("Invalid cancellation history.");
  }
  for (let i = 0; i < records.length; i++) for (let j = i + 1; j < records.length; j++) {
    const a = records[i], b = records[j];
    if (a.status === "draft" && b.status === "draft" && a.worksite_id === b.worksite_id && a.payroll_group.trim().toLowerCase() === b.payroll_group.trim().toLowerCase() && a.period_start <= b.period_end && a.period_end >= b.period_start) throw new Error("An active run already overlaps this worksite, payroll group and period.");
  }
}
export function runDates(run: PayrollRunInput) {
  validateRunInput(run);
  const result: string[] = [];
  for (let stamp = Date.parse(run.period_start); stamp <= Date.parse(run.period_end); stamp += 86400000) result.push(new Date(stamp).toISOString().slice(0, 10));
  return result;
}
export function runPage(records: PayrollRun[], q: PayrollRunQuery) {
  validateRunPagination(q.limit || 25, q.offset || 0);
  const terms = (q.search || "").toLowerCase().split(/[\s,]+/).filter(Boolean);
  const filtered = records.filter((r) => (q.includeCancelled || r.status !== "cancelled") && terms.every((term) => `${r.title} ${r.worksite_label} ${r.payroll_group}`.toLowerCase().includes(term))).sort((a, b) => b.period_start.localeCompare(a.period_start) || b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id));
  return { items: filtered.slice(q.offset || 0, (q.offset || 0) + Math.min(100, q.limit || 25)), total: filtered.length };
}
export function buildRunCoverage(run: PayrollRun, rows: AttendanceTeamRow[], limit = 25, offset = 0, search = ""): RunCoverage {
  validateRunPagination(limit, offset);
  if (run.status !== "draft") throw new Error("Cancelled runs cannot be prepared.");
  validateRunInput(run);
  const employees = new Map<string, RunCoverageRow>();
  const terms = search.trim().toLowerCase().split(/[\s,]+/).filter(Boolean);
  for (const row of rows) {
    if (!terms.every((term) => row.employeeLabel.toLowerCase().includes(term))) continue;
    const candidate = row.terms || row.baseTerms;
    if (!candidate || candidate.data.frequency !== run.frequency || candidate.data.payroll_group?.trim().toLowerCase() !== run.payroll_group.trim().toLowerCase()) continue;
    const r = employees.get(row.employeeId) || { employeeId: row.employeeId, employeeLabel: row.employeeLabel, expected: 0, approved: 0, missing: 0, drafts: 0, missingTerms: 0, changedTerms: 0, issues: [] };
    r.expected++;
    const notes: string[] = [];
    if (!row.terms) { r.missingTerms++; notes.push("Missing / expired terms"); }
    if (!row.attendance) { r.missing++; notes.push("Missing attendance"); }
    else {
      if (row.attendance.review_status === "approved") r.approved++; else { r.drafts++; notes.push("Draft attendance"); }
      if (row.terms && row.attendance.terms_id !== row.terms.id) { r.changedTerms++; notes.push("Pay terms changed after entry"); }
    }
    if (notes.length) r.issues.push({ date: row.date, message: notes.join("; ") });
    employees.set(row.employeeId, r);
  }
  const all = [...employees.values()].sort((a, b) => a.employeeLabel.localeCompare(b.employeeLabel) || a.employeeId.localeCompare(b.employeeId));
  const summary = { employees: all.length, expected: 0, approved: 0, missing: 0, drafts: 0, missingTerms: 0, changedTerms: 0 };
  for (const r of all) for (const key of ["expected", "approved", "missing", "drafts", "missingTerms", "changedTerms"] as const) summary[key] += r[key];
  return { items: all.slice(offset, offset + Math.min(100, Math.max(1, limit))), total: all.length, summary };
}
export function validateRunPagination(limit: number, offset: number) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0) throw new Error("Invalid payroll run page.");
}
