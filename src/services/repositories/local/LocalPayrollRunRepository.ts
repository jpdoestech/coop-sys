import type { AccessProfile } from "../../access/accessControl";
import { assertPayrollAccess } from "../../payroll/payrollAccess";
import { buildRunCoverage, payrollRunsKey, runDates, runPage, validateRunInput, validateRunRecords } from "../../payroll/payrollRuns";
import { buildAttendanceTeamPage } from "../../payroll/attendanceTeam";
import { payrollStorageKey } from "../../payroll/payrollSetup";
import { attendanceStorageKey } from "../../payroll/attendanceCore";
import { hydrateDatabaseStorage, readPersistentItem } from "../../server/databaseStorage";
import { serverRequest, usesServerBackend } from "../../server/serverApi";
import { createUuid } from "../../../utils/createUuid";
import { LocalEmployeeRepository } from "./LocalEmployeeRepository";
import type { PayrollRunRepository } from "../PayrollRunRepository";
import type { PayrollRun, PayrollRunInput, PayrollRunQuery, RunCoverage } from "../../../types/payrollRun";
import type { PayrollRecord } from "../../../types/payroll";
export class LocalPayrollRunRepository implements PayrollRunRepository {
  constructor(private profile: AccessProfile) {}
  private records(): PayrollRun[] { assertPayrollAccess(this.profile); return JSON.parse(readPersistentItem(payrollRunsKey) || "[]"); }
  async list(q: PayrollRunQuery) {
    assertPayrollAccess(this.profile);
    if (usesServerBackend()) return serverRequest<{ items: PayrollRun[]; total: number }>(`/payroll/runs?${new URLSearchParams({ search: q.search || "", includeCancelled: String(Boolean(q.includeCancelled)), limit: String(q.limit || 25), offset: String(q.offset || 0) })}`);
    return runPage(this.records(), q);
  }
  async create(input: PayrollRunInput) {
    assertPayrollAccess(this.profile, true); validateRunInput(input);
    if (usesServerBackend()) return serverRequest<PayrollRun>("/payroll/runs", { method: "POST", body: JSON.stringify(input) });
    const setup = JSON.parse(readPersistentItem(payrollStorageKey) || "[]") as PayrollRecord[];
    const site = setup.find((r) => r.id === input.worksite_id && r.kind === "worksite" && !r.deleted_at);
    if (!site) throw new Error("Worksite is unavailable.");
    const now = new Date().toISOString(), record: PayrollRun = { ...input, worksite_label: site.data.label, id: createUuid(), status: "draft", created_at: now, updated_at: now, created_by: this.profile.userId, cancelled_by: null, cancelled_at: null, cancel_reason: null };
    const next = [...this.records(), record]; validateRunRecords(next); localStorage.setItem(payrollRunsKey, JSON.stringify(next)); return record;
  }
  async cancel(id: string, reason: string) {
    assertPayrollAccess(this.profile, true);
    if (usesServerBackend()) return serverRequest<void>(`/payroll/runs/${id}/cancel`, { method: "POST", body: JSON.stringify({ reason }) });
    const records = this.records(), record = records.find((r) => r.id === id && r.status === "draft");
    if (!record) throw new Error("Select an active draft run.");
    const now = new Date().toISOString();
    const next = records.map((r) => r.id === id ? { ...r, status: "cancelled" as const, cancelled_by: this.profile.userId, cancelled_at: now, updated_at: now, cancel_reason: reason } : r);
    validateRunRecords(next); localStorage.setItem(payrollRunsKey, JSON.stringify(next));
  }
  async coverage(id: string, limit = 25, offset = 0): Promise<RunCoverage> {
    assertPayrollAccess(this.profile);
    if (usesServerBackend()) return serverRequest(`/payroll/runs/${id}/coverage?limit=${limit}&offset=${offset}`);
    const run = this.records().find((r) => r.id === id); if (!run) throw new Error("Run is unavailable.");
    await hydrateDatabaseStorage();
    const setup = JSON.parse(readPersistentItem(payrollStorageKey) || "[]"), attendance = JSON.parse(readPersistentItem(attendanceStorageKey) || "[]"), employees = await new LocalEmployeeRepository().list();
    const rows = runDates(run).flatMap((date) => {
      const q = { date, worksiteId: run.worksite_id, limit: 100 };
      const first = buildAttendanceTeamPage(setup, employees, attendance, q), items = [...first.items];
      for (let start = 100; start < first.total; start += 100) items.push(...buildAttendanceTeamPage(setup, employees, attendance, { ...q, offset: start }).items);
      return items;
    });
    return buildRunCoverage(run, rows, limit, offset);
  }
}
