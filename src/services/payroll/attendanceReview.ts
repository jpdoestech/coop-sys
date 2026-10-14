import { assertPermission, hasPermission, type AccessProfile } from "../access/accessControl";
import type { AttendanceQuery, AttendanceRecord } from "../../types/attendance";
import type { PayrollRecord } from "../../types/payroll";
import { resolvePayrollWorkDate } from "./payrollSetup";
import { validateAttendanceRecords } from "./attendanceCore";
export const attendancePoliciesKey = "coop_sys_attendance_review_policies";
export type AttendanceReviewPolicy = { branch_id: string; client_id: string | null; mode: "manual" | "automatic"; approver_ids: string[]; updated_by?: string; updated_at?: string };
export type AttendanceApprover = { id: string; label: string };
export type AttendanceReviewRow = AttendanceRecord & { review_can_approve: boolean; branch_id: string | null; client_id: string | null };
export function attendancePlacement(setup: PayrollRecord[], record: AttendanceRecord) {
  const site = setup.find((s) => s.id === record.terms_snapshot.worksite_id && s.kind === "worksite");
  return { branch_id: site?.data.branch_id || null, client_id: site?.data.client_id || null };
}
export function attendanceScope(profile: AccessProfile, branch: string | null, client: string | null, employee?: string) {
  const scope = profile.scopeType || (profile.branchIds.length ? "assigned_branches" : "organization");
  if (scope === "organization") return true;
  if (scope === "self") return Boolean(employee && employee === profile.linkedEmployeeId);
  if (scope === "assigned_clients") return Boolean(client && profile.clientIds?.includes(client));
  return Boolean(branch && profile.branchIds.includes(branch));
}
export function assertAttendanceReview(profile: AccessProfile) { assertPermission(profile, "payroll.view"); }
export function attendancePolicy(policies: AttendanceReviewPolicy[], branch: string | null, client: string | null) {
  return policies.find((p) => p.branch_id === branch && p.client_id === client);
}
export function canReviewAttendance(profile: AccessProfile, record: AttendanceRecord, setup: PayrollRecord[], policies: AttendanceReviewPolicy[]) {
  const placement = attendancePlacement(setup, record);
  return hasPermission(profile, "payroll.approve") && profile.scopeType !== "self" && attendanceScope(profile, placement.branch_id, placement.client_id, record.employee_id)
    && (profile.role === "super_admin" || Boolean(attendancePolicy(policies, placement.branch_id, placement.client_id)?.approver_ids.includes(profile.userId)));
}
export function attendanceReviewRows(profile: AccessProfile, records: AttendanceRecord[], setup: PayrollRecord[], policies: AttendanceReviewPolicy[], query: AttendanceQuery) {
  assertAttendanceReview(profile);
  if (query.dateFrom && query.dateTo && query.dateFrom > query.dateTo || query.reviewStatus && !["draft", "approved"].includes(query.reviewStatus)) throw new Error("Invalid attendance filters.");
  const terms = (query.search || "").trim().toLowerCase().split(/[\s,]+/).filter(Boolean);
  return records.flatMap((record) => {
    const p = attendancePlacement(setup, record);
    if (!attendanceScope(profile, p.branch_id, p.client_id, record.employee_id) || !query.includeArchived && record.deleted_at || query.employeeId && record.employee_id !== query.employeeId
      || query.dateFrom && record.work_date < query.dateFrom || query.dateTo && record.work_date > query.dateTo || query.reviewStatus && record.review_status !== query.reviewStatus
      || query.branchId && query.branchId !== p.branch_id || query.clientId !== undefined && query.clientId !== p.client_id
      || query.departmentId && query.departmentId !== record.terms_snapshot.department_id || query.positionId && query.positionId !== record.terms_snapshot.position_id
      || !terms.every((t) => record.employee_label.toLowerCase().includes(t))) return [];
    return [{ ...record, ...p, review_can_approve: !record.deleted_at && !record.payroll_posted_at && record.review_status === "draft" && canReviewAttendance(profile, record, setup, policies) }];
  }).sort((a, b) => b.work_date.localeCompare(a.work_date) || a.employee_label.localeCompare(b.employee_label) || a.id.localeCompare(b.id));
}
export function validateAttendancePolicy(policy: AttendanceReviewPolicy, profile: AccessProfile, approvers: AttendanceApprover[]) {
  assertAttendanceReview(profile); assertPermission(profile, "payroll.manage"); assertPermission(profile, "payroll.approve");
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuid.test(policy.branch_id) || policy.client_id && !uuid.test(policy.client_id) || !["manual", "automatic"].includes(policy.mode) || !Array.isArray(policy.approver_ids) || policy.approver_ids.length > 100 || new Set(policy.approver_ids).size !== policy.approver_ids.length) throw new Error("Select a valid review policy and approvers.");
  if (!attendanceScope(profile, policy.branch_id, policy.client_id) || profile.scopeType === "self") throw new Error("Review policy is outside your assigned scope.");
  if (policy.approver_ids.some((id) => !approvers.some((a) => a.id === id))) throw new Error("Approvers must be active payroll approvers assigned to this branch/client.");
}
type ReviewEmployee = { id: string; date_hired?: string | null; date_separated?: string | null; deleted_at?: string | null };
function currentAttendance(record: AttendanceRecord, setup: PayrollRecord[], employees: ReviewEmployee[]) {
  const employee = employees.find((e) => e.id === record.employee_id && !e.deleted_at);
  if (!employee || employee.date_hired && record.work_date < employee.date_hired || employee.date_separated && record.work_date > employee.date_separated) throw new Error(`${record.employee_label}: attendance is outside the employment period.`);
  const resolved = resolvePayrollWorkDate(setup, record.employee_id, record.work_date);
  if (!resolved.terms || resolved.terms.id !== record.terms_id) throw new Error(`${record.employee_label}: pay terms changed. Correct attendance before review.`);
}
export function approveAttendanceSelection(profile: AccessProfile, records: AttendanceRecord[], setup: PayrollRecord[], policies: AttendanceReviewPolicy[], employees: ReviewEmployee[], input: { ids?: string[]; query?: AttendanceQuery }, stamp: string) {
  assertAttendanceReview(profile); assertPermission(profile, "payroll.approve");
  let ids: string[];
  if (input.ids) {
    if (!Array.isArray(input.ids) || !input.ids.length || input.ids.length > 500 || new Set(input.ids).size !== input.ids.length) throw new Error("Select between 1 and 500 distinct records.");
    ids = input.ids;
  } else if (input.query) ids = attendanceReviewRows(profile, records, setup, policies, { ...input.query, includeArchived: false, reviewStatus: "draft" }).filter((r) => r.review_can_approve).map((r) => r.id);
  else throw new Error("Select attendance records or matching filters.");
  if (!ids.length || ids.length > 10000) throw new Error("No eligible pending records, or more than 10,000 matches. Narrow the filters.");
  const selected = new Set(ids);
  for (const id of ids) {
    const record = records.find((r) => r.id === id && !r.deleted_at);
    if (!record || record.review_status !== "draft" || record.payroll_posted_at || !canReviewAttendance(profile, record, setup, policies)) throw new Error("Some attendance is unavailable, already reviewed, posted, or outside your approval assignment.");
    currentAttendance(record, setup, employees);
  }
  const next = records.map((r) => selected.has(r.id) ? { ...r, review_status: "approved" as const, approval_mode: "manual" as const, reviewed_by: profile.userId, reviewed_at: stamp, updated_at: stamp } : r);
  validateAttendanceRecords(next); return { records: next, count: ids.length };
}
export function applyAutomaticReview(records: AttendanceRecord[], setup: PayrollRecord[], policies: AttendanceReviewPolicy[], employees: ReviewEmployee[], stamp: string) {
  return records.map((r) => {
    const p = attendancePlacement(setup, r);
    if (r.deleted_at || r.payroll_posted_at || r.review_status === "approved" || attendancePolicy(policies, p.branch_id, p.client_id)?.mode !== "automatic") return r;
    try { currentAttendance(r, setup, employees); } catch { return r; }
    return { ...r, review_status: "approved" as const, approval_mode: "automatic" as const, reviewed_by: null, reviewed_at: stamp, updated_at: stamp };
  });
}
