import { supabase } from "../../../database/supabase/client";
import type { AttendanceInput, AttendanceQuery, AttendanceRecord } from "../../../types/attendance";
import type { AccessProfile } from "../../access/accessControl";
import { assertPermission } from "../../access/accessControl";
import { assertPayrollAccess } from "../../payroll/payrollAccess";
import { validateAttendanceInput } from "../../payroll/attendanceCore";
import type { AttendanceRepository } from "../AttendanceRepository";
import { validateTeamQuery, type AttendanceTeamQuery, type AttendanceTeamPage } from "../../payroll/attendanceTeam";
function db() { if (!supabase) throw new Error("Supabase is not configured."); return supabase; }
export class SupabaseAttendanceRepository implements AttendanceRepository {
  constructor(private profile: AccessProfile) {}
  async worksheet(q: AttendanceTeamQuery): Promise<AttendanceTeamPage> {
    assertPayrollAccess(this.profile); validateTeamQuery(q);
    const { data, error } = await db().rpc("attendance_team_page", { p_date: q.date, p_worksite_id: q.worksiteId, p_department_id: q.departmentId || null, p_search: q.search || null, p_limit: q.limit || 25, p_offset: q.offset || 0 });
    if (error) throw new Error(error.message);
    return data as AttendanceTeamPage;
  }
  async list(q: AttendanceQuery) {
    assertPayrollAccess(this.profile);
    const { data, error } = await db().rpc("attendance_page", { p_search: q.search || null, p_from: q.dateFrom || null, p_to: q.dateTo || null, p_employee_id: q.employeeId || null, p_review: q.reviewStatus || null, p_archived: Boolean(q.includeArchived), p_limit: q.limit || 25, p_offset: q.offset || 0 });
    if (error) throw new Error(error.message);
    return data as { items: AttendanceRecord[]; total: number };
  }
  async saveBatch(input: AttendanceInput[]) {
    assertPayrollAccess(this.profile, true);
    if (!input.length || input.length > 500) throw new Error("Save between 1 and 500 attendance records per batch.");
    input.forEach(validateAttendanceInput);
    const { error } = await db().rpc("save_attendance_batch", { p_records: input });
    if (error) throw new Error(error.message);
  }
  async approve(id: string) {
    assertPayrollAccess(this.profile); assertPermission(this.profile, "payroll.approve");
    const { error } = await db().rpc("approve_attendance", { p_id: id });
    if (error) throw new Error(error.message);
  }
}
