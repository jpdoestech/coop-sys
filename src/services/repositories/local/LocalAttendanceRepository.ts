import type { AttendanceInput, AttendanceQuery, AttendanceRecord } from "../../../types/attendance";
import type { AccessProfile } from "../../access/accessControl";
import { assertPermission } from "../../access/accessControl";
import { assertPayrollAccess } from "../../payroll/payrollAccess";
import { attendanceStorageKey, validateAttendanceInput, validateAttendanceRecords } from "../../payroll/attendanceCore";
import { resolvePayrollWorkDate } from "../../payroll/payrollSetup";
import { flushDatabaseStorage, hydrateDatabaseStorage, readPersistentItem, writePersistentItem } from "../../server/databaseStorage";
import { createUuid } from "../../../utils/createUuid";
import type { AttendanceRepository } from "../AttendanceRepository";
import { LocalPayrollRepository } from "./LocalPayrollRepository";
import { LocalEmployeeRepository } from "./LocalEmployeeRepository";
import { buildAttendanceTeamPage, cutoffTeamQuery, validateTeamQuery, type AttendanceTeamQuery, type AttendanceTeamPage } from "../../payroll/attendanceTeam";
import { payrollRunsKey } from "../../payroll/payrollRuns";
import type { PayrollRun } from "../../../types/payrollRun";
import { payrollStorageKey } from "../../payroll/payrollSetup";
import { serverRequest, usesServerBackend } from "../../server/serverApi";

export class LocalAttendanceRepository implements AttendanceRepository {
  constructor(private profile: AccessProfile) {}
  async worksheet(q: AttendanceTeamQuery): Promise<AttendanceTeamPage> {
    assertPayrollAccess(this.profile); validateTeamQuery(q);
    if (usesServerBackend()) {
      const params = new URLSearchParams({ date: q.date, worksiteId: q.worksiteId, limit: String(q.limit || 25), offset: String(q.offset || 0) });
      if (q.departmentId) params.set("departmentId", q.departmentId);
      if (q.search) params.set("search", q.search);
      if (q.runId) params.set("runId", q.runId);
      return serverRequest(`/attendance/worksheet?${params}`);
    }
    const records = await this.records();
    const runs = JSON.parse(readPersistentItem(payrollRunsKey) || "[]") as PayrollRun[];
    const filters = q.runId ? cutoffTeamQuery(q, runs.find((r) => r.id === q.runId)) : q;
    return buildAttendanceTeamPage(JSON.parse(readPersistentItem(payrollStorageKey) || "[]"), await new LocalEmployeeRepository().list(), records, filters);
  }
  private async records() { assertPayrollAccess(this.profile); await hydrateDatabaseStorage(); return JSON.parse(readPersistentItem(attendanceStorageKey) || "[]") as AttendanceRecord[]; }
  async list(q: AttendanceQuery) {
    const terms = (q.search || "").toLowerCase().split(/[\s,]+/).filter(Boolean);
    const rows = (await this.records()).filter((r) => (q.includeArchived || !r.deleted_at) && (!q.employeeId || r.employee_id === q.employeeId) && (!q.dateFrom || r.work_date >= q.dateFrom) && (!q.dateTo || r.work_date <= q.dateTo) && (!q.reviewStatus || r.review_status === q.reviewStatus) && terms.every((t) => r.employee_label.toLowerCase().includes(t))).sort((a, b) => b.work_date.localeCompare(a.work_date) || a.employee_label.localeCompare(b.employee_label));
    return { items: rows.slice(q.offset || 0, (q.offset || 0) + Math.min(100, q.limit || 25)), total: rows.length };
  }
  private async persist(records: AttendanceRecord[]) {
    validateAttendanceRecords(records);
    const previous = readPersistentItem(attendanceStorageKey);
    writePersistentItem(attendanceStorageKey, JSON.stringify(records));
    try { await flushDatabaseStorage(); } catch (error) { if (previous) localStorage.setItem(attendanceStorageKey, previous); else localStorage.removeItem(attendanceStorageKey); throw error; }
  }
  async saveBatch(inputs: AttendanceInput[]) {
    assertPayrollAccess(this.profile, true);
    if (!inputs.length || inputs.length > 500) throw new Error("Save between 1 and 500 attendance records per batch.");
    const records = await this.records(), next = structuredClone(records), now = new Date().toISOString();
    for (const input of inputs) {
      validateAttendanceInput(input);
      const employee = await new LocalEmployeeRepository().getById(input.employee_id);
      if (!employee || employee.deleted_at || employee.date_hired && input.work_date < employee.date_hired || employee.date_separated && input.work_date > employee.date_separated) throw new Error("Attendance date is outside this employee's employment period.");
      const result = resolvePayrollWorkDate(await new LocalPayrollRepository(this.profile).workDateRecords(input.employee_id, input.work_date), input.employee_id, input.work_date);
      if (!result.terms || result.terms.id !== input.terms_id) throw new Error("Applicable pay terms changed or are missing. Reload this work date.");
      if (input.status === "rest_day" && !result.restDay) throw new Error("Record a schedule override before marking this date as a rest day.");
      if (input.replace_id) {
        const previous = next.find((r) => r.id === input.replace_id && !r.deleted_at);
        if (!previous || previous.employee_id !== input.employee_id || previous.work_date !== input.work_date || previous.review_status === "approved") throw new Error("Only the current draft for the same employee/date can be corrected.");
        previous.deleted_at = now; previous.updated_at = now;
      }
      const { replace_id, ...values } = input;
      next.push({ ...structuredClone(values), employee_label: `${employee.employee_number} - ${employee.last_name}, ${employee.first_name}`, id: createUuid(), terms_snapshot: structuredClone(result.terms.data), review_status: "draft", created_by: this.profile.userId, created_at: now, updated_at: now, reviewed_by: null, reviewed_at: null, deleted_at: null, supersedes_id: replace_id || null });
    }
    await this.persist(next);
  }
  async approve(id: string) {
    assertPayrollAccess(this.profile); assertPermission(this.profile, "payroll.approve");
    const records = await this.records(), record = records.find((r) => r.id === id && !r.deleted_at);
    if (!record || record.review_status !== "draft") throw new Error("Select a current draft attendance record.");
    const employee = await new LocalEmployeeRepository().getById(record.employee_id);
    if (!employee || employee.deleted_at || employee.date_hired && record.work_date < employee.date_hired || employee.date_separated && record.work_date > employee.date_separated) throw new Error("Attendance date is outside this employee's employment period.");
    const resolution = resolvePayrollWorkDate(await new LocalPayrollRepository(this.profile).workDateRecords(record.employee_id, record.work_date), record.employee_id, record.work_date);
    if (!resolution.terms || resolution.terms.id !== record.terms_id) throw new Error("Pay terms changed. Correct the draft before approval.");
    const now = new Date().toISOString();
    await this.persist(records.map((r) => r.id === id ? { ...r, review_status: "approved", reviewed_by: this.profile.userId, reviewed_at: now, updated_at: now } : r));
  }
}
