import type { AccessProfile } from "../../access/accessControl";
import type { PayrollInput, PayrollRecord } from "../../../types/payroll";
import { assertPayrollAccess } from "../../payroll/payrollAccess";
import { payrollStorageKey, validatePayrollInput, validatePayrollRecords, effectivePayrollRecord } from "../../payroll/payrollSetup";
import { serverRequest, usesServerBackend } from "../../server/serverApi";
import { flushDatabaseStorage, hydrateDatabaseStorage, readPersistentItem, writePersistentItem } from "../../server/databaseStorage";
import { createUuid } from "../../../utils/createUuid";
import type { PayrollQuery, PayrollRepository } from "../PayrollRepository";
import { LocalEmployeeRepository } from "./LocalEmployeeRepository";
import { LocalOrganizationDirectoryRepository } from "./LocalOrganizationDirectoryRepository";
import { attendanceStorageKey } from "../../payroll/attendanceCore";
import type { AttendanceRecord } from "../../../types/attendance";

export class LocalPayrollRepository implements PayrollRepository {
  constructor(private profile: AccessProfile) {}
  private async records() {
    assertPayrollAccess(this.profile);
    await hydrateDatabaseStorage();
    return JSON.parse(readPersistentItem(payrollStorageKey) || "[]") as PayrollRecord[];
  }
  async list(query: PayrollQuery) {
    const records = (await this.records()).filter((r) => (query.includeArchived || !r.deleted_at) && r.kind === query.kind && (!query.asOf || r.data.effective_from! <= query.asOf) && (!query.employeeId || r.data.employee_id === query.employeeId) && (!query.worksiteId || r.data.worksite_id === query.worksiteId) && (!query.branchId || r.data.branch_id === query.branchId) && (query.clientId === undefined || (r.data.client_id || null) === query.clientId) && (!query.search || r.data.label.toLowerCase().includes(query.search.toLowerCase()))).sort((a, b) => (b.data.effective_from || b.created_at).localeCompare(a.data.effective_from || a.created_at));
    const offset = query.offset || 0;
    return { items: records.slice(offset, offset + Math.min(100, query.limit || 25)), total: records.length };
  }
  private async write(records: PayrollRecord[]) {
    const previous = readPersistentItem(payrollStorageKey);
    validatePayrollRecords(records);
    writePersistentItem(payrollStorageKey, JSON.stringify(records));
    try { await flushDatabaseStorage(); } catch (error) {
      if (previous) localStorage.setItem(payrollStorageKey, previous); else localStorage.removeItem(payrollStorageKey);
      throw error;
    }
  }
  async save(input: PayrollInput) {
    return (await this.saveBatch([input]))[0];
  }
  async saveBatch(inputs: PayrollInput[]) {
    assertPayrollAccess(this.profile, true);
    if (!inputs.length || inputs.length > 500) throw new Error("Select between 1 and 500 payroll records.");
    inputs.forEach(validatePayrollInput);
    if (usesServerBackend()) {
      const result = await serverRequest<PayrollRecord[]>("/payroll/setup/batch", { method: "POST", body: JSON.stringify({ inputs }) });
      await hydrateDatabaseStorage(); return result;
    }
    await this.records();
    const directory = await new LocalOrganizationDirectoryRepository().getDirectory();
    const additions: PayrollRecord[] = [];
    for (const input of inputs) {
      if (input.kind === "worksite" && (!directory.branches.some((b) => b.id === input.data.branch_id && b.isActive) || input.data.client_id && !directory.clients.some((c) => c.id === input.data.client_id && c.branchId === input.data.branch_id && c.isActive))) throw new Error("Select an active branch and a client belonging to that branch.");
      if (input.data.employee_id) {
        const employee = await new LocalEmployeeRepository().getById(input.data.employee_id);
        if (!employee || employee.deleted_at) throw new Error("Employee is unavailable.");
        if (input.kind === "deduction" && input.data.deduction_type === "cooperative" && !employee.member_id) throw new Error("Cooperative deductions require a linked member.");
      }
      if (input.data.department_id && !directory.departments.some((d) => d.id === input.data.department_id && d.isActive)) throw new Error("Department is unavailable.");
      if (input.data.position_id && !directory.positions.some((p) => p.id === input.data.position_id && p.isActive && (!input.data.department_id || p.departmentId === input.data.department_id))) throw new Error("Position must belong to the selected department.");
      const timestamp = new Date().toISOString();
      const record: PayrollRecord = { kind: input.kind, data: structuredClone(input.data), id: createUuid(), created_at: timestamp, updated_at: timestamp, created_by: this.profile.userId, deleted_at: null };
      additions.push(record);
    }
    const current = JSON.parse(readPersistentItem(payrollStorageKey) || "[]") as PayrollRecord[];
    for (const input of inputs) if (input.expected_source_id !== undefined) {
      if (input.kind !== "employee_terms") throw new Error("Source checks require employee terms.");
      const base = effectivePayrollRecord(current.filter((r) => r.kind === "employee_terms" && r.data.employee_id === input.data.employee_id), input.data.effective_from!);
      if ((base?.id || null) !== input.expected_source_id) throw new Error("Employee terms changed. Reload the preview before saving.");
    }
    await this.write([...current, ...additions]); return additions;
  }
  async archive(id: string) {
    assertPayrollAccess(this.profile, true);
    const records = await this.records();
    const attendance = JSON.parse(readPersistentItem(attendanceStorageKey) || "[]") as AttendanceRecord[];
    if (attendance.some((r) => r.review_status === "approved" && (r.terms_id === id || r.terms_snapshot.worksite_id === id))) throw new Error("Approved attendance references this setup record. Use a new effective-dated version.");
    if (!records.some((r) => r.id === id && !r.deleted_at)) throw new Error("Payroll setup record is unavailable.");
    const now = new Date().toISOString();
    await this.write(records.map((r) => r.id === id ? { ...r, deleted_at: now, updated_at: now } : r));
  }
  async workDateRecords(employeeId: string, date: string) {
    return (await this.records()).filter((r) => !r.deleted_at && (r.kind === "worksite" || r.kind === "wage" || r.kind === "cooperative_policy" || r.data.employee_id === employeeId && r.data.effective_from! <= date));
  }
}
