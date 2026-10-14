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
import { buildCalculationSource, calculationRulesKey, rulePage, validateCalculationRule, validateCalculationRecords } from "../../payroll/payrollCalculation";
import type { CalculationRule, CalculationRuleInput, CalculationSource } from "../../../types/payrollCalculation";
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
  async coverage(id: string, limit = 25, offset = 0, search = ""): Promise<RunCoverage> {
    assertPayrollAccess(this.profile);
    if (usesServerBackend()) return serverRequest(`/payroll/runs/${id}/coverage?limit=${limit}&offset=${offset}&search=${encodeURIComponent(search)}`);
    const run = this.records().find((r) => r.id === id); if (!run) throw new Error("Run is unavailable.");
    const { rows } = await this.context(run);
    return buildRunCoverage(run, rows, limit, offset, search);
  }
  private async context(run: PayrollRun) {
    await hydrateDatabaseStorage();
    const setup = JSON.parse(readPersistentItem(payrollStorageKey) || "[]"), attendance = JSON.parse(readPersistentItem(attendanceStorageKey) || "[]"), employees = await new LocalEmployeeRepository().list();
    const rows = runDates(run).flatMap((date) => {
      const q = { date, worksiteId: run.worksite_id, limit: 100 };
      const first = buildAttendanceTeamPage(setup, employees, attendance, q), items = [...first.items];
      for (let start = 100; start < first.total; start += 100) items.push(...buildAttendanceTeamPage(setup, employees, attendance, { ...q, offset: start }).items);
      return items;
    });
    return { rows, setup, members: Object.fromEntries(employees.map((e) => [e.id, Boolean(e.member_id)])) };
  }
  async listRules(kind: "policy" | "calendar", site: string, limit = 25, offset = 0) {
    assertPayrollAccess(this.profile);
    if (usesServerBackend()) return serverRequest<{ items: CalculationRule[]; total: number }>(`/payroll/calculation-rules?kind=${kind}&site=${site}&limit=${limit}&offset=${offset}`);
    return rulePage(JSON.parse(readPersistentItem(calculationRulesKey) || "[]"), kind, site, limit, offset);
  }
  async saveRules(inputs: CalculationRuleInput[]) {
    assertPayrollAccess(this.profile, true);
    if (!inputs.length || inputs.length > 31) throw new Error("Save between 1 and 31 calculation rules.");
    inputs.forEach(validateCalculationRule);
    if (usesServerBackend()) return serverRequest<void>("/payroll/calculation-rules", { method: "POST", body: JSON.stringify(inputs) });
    const setup = JSON.parse(readPersistentItem(payrollStorageKey) || "[]") as PayrollRecord[];
    if (inputs.some((i) => !setup.some((s) => s.id === i.worksite_id && s.kind === "worksite" && !s.deleted_at))) throw new Error("Worksite is unavailable.");
    const previous = JSON.parse(readPersistentItem(calculationRulesKey) || "[]") as CalculationRule[];
    const time = previous.reduce((max, r) => Math.max(max, Date.parse(r.created_at) + 1), Date.now());
    const next = [...previous, ...inputs.map((i, index) => ({ ...i, id: createUuid(), created_by: this.profile.userId, created_at: new Date(time + index).toISOString() }))];
    validateCalculationRecords(next); localStorage.setItem(calculationRulesKey, JSON.stringify(next));
  }
  async previewSource(id: string, limit = 25, offset = 0, search = ""): Promise<CalculationSource> {
    assertPayrollAccess(this.profile);
    if (usesServerBackend()) return serverRequest(`/payroll/runs/${id}/preview?limit=${limit}&offset=${offset}&search=${encodeURIComponent(search)}`);
    const run = this.records().find((r) => r.id === id); if (!run) throw new Error("Run is unavailable.");
    const { rows, setup, members } = await this.context(run);
    return buildCalculationSource(run, rows, setup, JSON.parse(readPersistentItem(calculationRulesKey) || "[]"), members, limit, offset, search);
  }
}
