import { supabase } from "../../database/supabase/client";
import { getAppMode } from "../../utils/env";
import { serverRequest, usesServerBackend } from "../server/serverApi";
import { isSupabaseConfigured } from "../../database/supabase/client";
import type { AccessProfile } from "../access/accessControl";
import { hasPermission } from "../access/accessControl";
import { accessProfileForUser } from "../access/userAccessModel";
import { LocalUserAccessRepository } from "../repositories/local/LocalUserAccessRepository";
import { LocalOrganizationDirectoryRepository } from "../repositories/local/LocalOrganizationDirectoryRepository";
import { LocalEmployeeRepository } from "../repositories/local/LocalEmployeeRepository";
import type { AttendanceQuery, AttendanceRecord } from "../../types/attendance";
import type { PayrollRecord } from "../../types/payroll";
import { attendanceStorageKey, validateAttendanceRecords } from "./attendanceCore";
import { payrollStorageKey } from "./payrollSetup";
import { applyAutomaticReview, approveAttendanceSelection, assertAttendanceReview, attendancePoliciesKey, attendanceReviewRows, attendanceScope, validateAttendancePolicy, type AttendanceApprover, type AttendanceReviewPolicy, type AttendanceReviewRow } from "./attendanceReview";
function online() { const mode = getAppMode(); return mode === "ONLINE" || mode === "AUTO" && isSupabaseConfigured && navigator.onLine; }
function read<T>(key: string): T[] { return JSON.parse(localStorage.getItem(key) || "[]"); }
async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> { if (!supabase) throw new Error("Supabase is not configured."); const { data, error } = await supabase.rpc(name, args); if (error) throw new Error(error.message); return data as T; }
export class AttendanceReviewService {
  constructor(private profile: AccessProfile) {}
  async list(query: AttendanceQuery): Promise<{ items: AttendanceReviewRow[]; total: number }> {
    assertAttendanceReview(this.profile);
    const limit = query.limit || 25, offset = query.offset || 0;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0) throw new Error("Invalid review page.");
    if (usesServerBackend()) return serverRequest(`/attendance/review?${new URLSearchParams({ query: JSON.stringify(query) })}`);
    if (online()) return rpc("attendance_review_page", { p_query: query });
    const rows = attendanceReviewRows(this.profile, read(attendanceStorageKey), read(payrollStorageKey), read(attendancePoliciesKey), query);
    return { items: rows.slice(offset, offset + limit), total: rows.length };
  }
  async approve(input: { ids?: string[]; query?: AttendanceQuery }): Promise<number> {
    assertAttendanceReview(this.profile);
    if (usesServerBackend()) return (await serverRequest<{ count: number }>("/attendance/review/approve", { method: "POST", body: JSON.stringify(input) })).count;
    if (online()) return rpc("approve_attendance_bulk", { p_input: input });
    const employees = await new LocalEmployeeRepository().list();
    const result = approveAttendanceSelection(this.profile, read(attendanceStorageKey), read(payrollStorageKey), read(attendancePoliciesKey), employees, input, new Date().toISOString());
    localStorage.setItem(attendanceStorageKey, JSON.stringify(result.records)); return result.count;
  }
  async policies(): Promise<AttendanceReviewPolicy[]> {
    assertAttendanceReview(this.profile);
    if (usesServerBackend()) return serverRequest("/attendance/review/policies");
    if (online()) return rpc("attendance_review_policies_page", {});
    return read<AttendanceReviewPolicy>(attendancePoliciesKey).filter((p) => attendanceScope(this.profile, p.branch_id, p.client_id));
  }
  async approvers(branch: string, client: string | null): Promise<AttendanceApprover[]> {
    assertAttendanceReview(this.profile);
    if (!attendanceScope(this.profile, branch, client) || this.profile.scopeType === "self") throw new Error("Branch/client is outside your assigned scope.");
    if (usesServerBackend()) return serverRequest(`/attendance/review/approvers?${new URLSearchParams({ branch, client: client || "" })}`);
    if (online()) return rpc("attendance_review_approvers", { p_branch: branch, p_client: client });
    const repository = new LocalUserAccessRepository(), roles = await repository.listRoles();
    return (await repository.listPage({ status: "active" })).items.flatMap((user) => { const p = accessProfileForUser(user, roles); return p.scopeType !== "self" && hasPermission(p, "payroll.view") && hasPermission(p, "payroll.approve") && attendanceScope(p, branch, client) ? [{ id: user.id, label: user.display_name }] : []; });
  }
  async savePolicy(policy: AttendanceReviewPolicy) {
    assertAttendanceReview(this.profile);
    if (usesServerBackend()) return serverRequest<void>("/attendance/review/policies", { method: "PUT", body: JSON.stringify(policy) });
    if (online()) return rpc<void>("save_attendance_review_policy", { p_policy: policy });
    const directory = await new LocalOrganizationDirectoryRepository().getDirectory();
    if (!directory.branches.some((b) => b.id === policy.branch_id && b.isActive) || policy.client_id && !directory.clients.some((c) => c.id === policy.client_id && c.branchId === policy.branch_id && c.isActive)) throw new Error("Select an active branch/client.");
    validateAttendancePolicy(policy, this.profile, await this.approvers(policy.branch_id, policy.client_id));
    const stamp = new Date().toISOString(), policies = [...read<AttendanceReviewPolicy>(attendancePoliciesKey).filter((p) => p.branch_id !== policy.branch_id || p.client_id !== policy.client_id), { ...policy, updated_by: this.profile.userId, updated_at: stamp }];
    const employees = await new LocalEmployeeRepository().list(), records = applyAutomaticReview(read<AttendanceRecord>(attendanceStorageKey), read<PayrollRecord>(payrollStorageKey), policies, employees, stamp);
    validateAttendanceRecords(records);
    const before = localStorage.getItem(attendancePoliciesKey), attendance = localStorage.getItem(attendanceStorageKey);
    try { localStorage.setItem(attendancePoliciesKey, JSON.stringify(policies)); localStorage.setItem(attendanceStorageKey, JSON.stringify(records)); }
    catch (error) { for (const [key, value] of [[attendancePoliciesKey, before], [attendanceStorageKey, attendance]]) if (value === null) localStorage.removeItem(key!); else localStorage.setItem(key!, value!); throw error; }
  }
}
