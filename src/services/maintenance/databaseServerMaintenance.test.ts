// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import ts from "typescript";

let child: ChildProcess, directory: string, base: string, cookie: string;
async function api(path: string, method = "GET", payload?: unknown, auth = cookie) {
  return fetch(`${base}/api${path}`, { method, headers: { Cookie: auth || "", "Content-Type": "application/json" }, body: payload === undefined ? undefined : JSON.stringify(payload) });
}

describe("SQLite server maintenance", () => {
  beforeAll(async () => {
    directory = mkdtempSync(join(tmpdir(), "coop-maintenance-test-"));
    const source = readFileSync(resolve("src/services/maintenance/cleanupCore.ts"), "utf8");
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const reportsSource = readFileSync(resolve("src/services/reports/sqliteReports.ts"), "utf8");
    const reportsCode = ts.transpileModule(reportsSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const matrixCode = ts.transpileModule(readFileSync(resolve("src/services/payroll/attendanceMatrix.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const scheduleCode = ts.transpileModule(readFileSync(resolve("src/services/payroll/payrollSchedule.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const reviewAccessCode = ts.transpileModule(readFileSync(resolve("src/services/access/accessControl.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const reviewCode = ts.transpileModule(readFileSync(resolve("src/services/payroll/attendanceReview.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const payrollCode = ts.transpileModule(readFileSync(resolve("src/services/payroll/payrollSetup.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const attendanceCode = ts.transpileModule(readFileSync(resolve("src/services/payroll/attendanceCore.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const teamCode = ts.transpileModule(readFileSync(resolve("src/services/payroll/attendanceTeam.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const runsCode = ts.transpileModule(readFileSync(resolve("src/services/payroll/payrollRuns.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const calculationCode = ts.transpileModule(readFileSync(resolve("src/services/payroll/payrollCalculation.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const template = readFileSync(resolve("tools/database-server/server-template.cjs"), "utf8").replace("__COOP_EMBEDDED_ASSETS__", "{}").replace("__COOP_MAINTENANCE__", `(() => { const exports = {}; ${code}; return exports; })()`).replace("__COOP_REPORTS__", `(() => { const exports = {}; ${reportsCode}; return exports; })()`).replace("__COOP_PAYROLL_SCHEDULE__", `(() => { const exports={}; ${scheduleCode}; return exports; })()`).replace("__COOP_PAYROLL__", `(() => { const exports = {}; const require = () => payrollSchedule; ${payrollCode}; return exports; })()`).replace("__COOP_ATTENDANCE_ACCESS__", `(() => { const exports={}; ${reviewAccessCode}; return exports; })()`).replace("__COOP_ATTENDANCE_REVIEW__", `(() => { const exports={}; const require=(id)=>({"../access/accessControl":attendanceAccess,"./attendanceCore":attendance,"./payrollSetup":payroll})[id]; ${reviewCode}; return exports; })()`).replace("__COOP_ATTENDANCE__", `(() => { const exports = {}; const require = () => payrollSchedule; ${attendanceCode}; return exports; })()`);
    const serverPath = join(directory, "test-server.cjs");
    writeFileSync(serverPath, template.replace("__COOP_ATTENDANCE_TEAM__", `(() => { const exports = {}; const require = () => payrollSchedule; ${teamCode}; return exports; })()`).replace("__COOP_PAYROLL_RUNS__", `(() => { const exports = {}; ${runsCode}; return exports; })()`).replace("__COOP_PAYROLL_CALCULATION__", `(() => { const exports={}; const require=(id)=>({"./attendanceCore":attendance,"./payrollSetup":payroll,"./payrollRuns":payrollRuns})[id]; ${calculationCode}; return exports; })()`).replace("__COOP_ATTENDANCE_MATRIX__", `(() => { const exports={}; const require=(id)=>({"./attendanceCore":attendance,"./payrollSchedule":payrollSchedule,"./payrollSetup":payroll,"./payrollRuns":payrollRuns})[id]; ${matrixCode}; return exports; })()`).replace('const port = Number(args.port || 8787);', 'const port = 0;').replace('console.log(`READY|${port}|', 'console.log(`READY|${server.address().port}|'));
    child = spawn(process.execPath, [serverPath, `--data-dir=${directory}`], { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    await new Promise<void>((resolveReady, reject) => {
      const timer = setTimeout(() => reject(new Error("Server startup timed out.")), 10000);
      child.once("exit", (code) => { clearTimeout(timer); reject(new Error(`Server exited: ${code}`)); });
      child.stdout!.on("data", (data: Buffer) => { const match = data.toString().match(/READY\|(\d+)\|/); if (match) { base = `http://127.0.0.1:${match[1]}`; clearTimeout(timer); resolveReady(); } });
    });
    const login = await api("/auth/login", "POST", { email: "admin@example.test", password: "ChangeMe123!" }, "");
    expect(login.status).toBe(200); cookie = login.headers.get("set-cookie")!.split(";")[0];
    const meta = { created_at: "2026-10-05", updated_at: "2026-10-05", sync_status: "synced", deleted_at: null };
    for (const [key, value] of Object.entries({ coop_sys_employees: [{ ...meta, id: "e1", employee_number: "000001", member_id: "m1", active_assignment: null }, { ...meta, id: "e2", employee_number: "000002", active_assignment: { id: "a1", branch_id: "b1" } }], coop_sys_members: [{ ...meta, id: "m1", membership_number: "000001" }], coop_sys_payment_ledger: { settings: [{ id: "settings" }], payments: [{ ...meta, id: "p1", employee_id: "e1", member_id: "m1", batch_id: "b1" }], batches: [{ id: "b1" }] } })) {
      expect((await api(`/storage/${key}`, "PUT", { value: JSON.stringify(value) })).status).toBe(200);
    }
  }, 15000);
  afterAll(async () => {
    if (child && child.exitCode === null) await new Promise<void>((done) => { child.once("exit", () => done()); child.kill(); });
    if (directory && resolve(directory).startsWith(resolve(tmpdir()) + sep)) rmSync(directory, { recursive: true, force: true });
  });
  it("paginates on the server and rejects invalid confirmations without changes", async () => {
    const reports = await api("/reports?kind=employees&limit=1&offset=1&sort=number");
    expect(reports.status).toBe(200);
    expect(await reports.json()).toMatchObject({ total: 2, records: 2, items: [{ id: "e2" }] });
    expect((await api("/reports?kind=employees", "GET", undefined, "")).status).toBe(401);
    const list = await api("/maintenance/people?kind=employee&limit=1&offset=1&state=active");
    expect(await list.json()).toMatchObject({ total: 2, items: [{ id: "e2" }] });
    const result = await api("/maintenance/people", "POST", { kind: "employee", action: "hard", target: "selected", ids: ["e1"], confirmation: "wrong" });
    expect(result.status).toBe(400);
    const unchanged = await api("/maintenance/people?kind=employee&state=all");
    expect((await unchanged.json()).total).toBe(2);
  });
  it("rejects non-super-admin API calls even with settings permissions", async () => {
    const created = await api("/users", "POST", { display_name: "Limited test", email: "limited@example.test", role: "branch_user", role_ids: ["70000000-0000-4000-8000-000000000007"], branch_ids: [], client_ids: [], scope_type: "organization", direct_grants: ["settings.manage", "reports.view", "employees.view"], direct_denies: ["reports.export", "members.view"], temporary_password: "TestPassword2026!", is_active: true });
    expect(created.status).toBe(201);
    const login = await api("/auth/login", "POST", { email: "limited@example.test", password: "TestPassword2026!" }, "");
    const limitedCookie = login.headers.get("set-cookie")!.split(";")[0];
    expect((await api("/reports?kind=employees", "GET", undefined, limitedCookie)).status).toBe(200);
    expect((await api("/reports?kind=employees&exporting=true", "GET", undefined, limitedCookie)).status).toBe(403);
    expect((await api("/reports?kind=members", "GET", undefined, limitedCookie)).status).toBe(403);
    expect((await api("/maintenance/people?kind=employee", "GET", undefined, limitedCookie)).status).toBe(403);
    expect((await api("/maintenance/people", "POST", { kind: "employee", action: "reset", target: "all", ids: [], confirmation: "RESET" }, limitedCookie)).status).toBe(403);
    expect((await api("/members/approval-number", "GET", undefined, limitedCookie)).status).toBe(403);
    expect((await api("/members/approve", "POST", { ids: ["m1"], approvalDate: "2026-10-07" }, limitedCookie)).status).toBe(403);
  });
  it("allocates SQLite BOD numbers atomically and rejects repeated approvals", async () => {
    const storage = await (await api("/storage")).json();
    const members = JSON.parse(storage.coop_sys_members);
    members[0].bod_approval_status = "pending";
    members[0].updated_at = new Date().toISOString();
    expect((await api("/storage/coop_sys_members", "PUT", { value: JSON.stringify(members) })).status).toBe(200);
    expect(await (await api("/members/approval-number")).json()).toEqual({ number: "000001" });
    expect((await api("/members/approve", "POST", { ids: ["m1"], approvalDate: "2026-02-30" })).status).toBe(400);
    const result = await api("/members/approve", "POST", { ids: ["m1"], approvalDate: "2026-10-07" });
    const approval = await result.json();
    expect(approval).toEqual({ number: "000001" });
    expect(result.status).toBe(200);
    expect((await api("/members/approve", "POST", { ids: ["m1"], approvalDate: "2026-10-07" })).status).toBe(400);
    expect(await (await api("/members/approval-number")).json()).toEqual({ number: "000002" });
    const approved = await (await api("/storage")).json();
    expect(JSON.parse(approved.coop_sys_members)[0]).toMatchObject({ bod_approval_status: "approved", acceptance_resolution_number: "000001", acceptance_date: "2026-10-07" });
    expect(JSON.parse(approved.coop_sys_employees)[0].employment_status_id).toBe("33000000-0000-4000-8000-000000000001");
  });
  it("removes linked records and payments atomically while keeping users and settings", async () => {
    const result = await api("/maintenance/people", "POST", { kind: "employee", action: "hard", target: "unassigned", ids: [], confirmation: "DELETE" });
    expect(result.status).toBe(200); expect(await result.json()).toEqual({ employees: 1, members: 1, payments: 1 });
    const storage = await (await api("/storage")).json();
    expect(JSON.parse(storage.coop_sys_employees)).toMatchObject([{ id: "e2" }]);
    expect(JSON.parse(storage.coop_sys_members)).toEqual([]);
    expect(JSON.parse(storage.coop_sys_payment_ledger)).toMatchObject({ payments: [], settings: [{ id: "settings" }] });
    expect((await (await api("/users")).json()).total).toBe(2);
  });
  it("stores cooperative policies but rejects overwritten history and hides salary setup from ordinary users", async () => {
    const session = await (await api("/auth/session")).json();
    const actor = session.session.profile.userId;
    const record = { id: "10000000-0000-4000-8000-000000000001", kind: "cooperative_policy", data: { label: "Cutoff policy", reason: "Approved policy", effective_from: "2026-10-01", deduction_centavos: 5000 }, created_by: actor, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), deleted_at: null };
    expect((await api("/storage/coop_sys_payroll_setup", "PUT", { value: JSON.stringify([record]) })).status).toBe(200);
    const altered = { ...record, data: { ...record.data, deduction_centavos: 10000 } };
    const denied = await api("/storage/coop_sys_payroll_setup", "PUT", { value: JSON.stringify([altered]) });
    expect(denied.status).toBeGreaterThanOrEqual(400);
    expect(JSON.parse((await (await api("/storage")).json()).coop_sys_payroll_setup)[0].data.deduction_centavos).toBe(5000);
    const login = await api("/auth/login", "POST", { email: "limited@example.test", password: "TestPassword2026!" }, "");
    expect(login.status).toBe(200);
    const otherCookie = login.headers.get("set-cookie")!.split(";")[0];
    expect((await (await api("/storage", "GET", undefined, otherCookie)).json()).coop_sys_payroll_setup).toBeUndefined();
    expect((await api("/storage/coop_sys_payroll_setup", "PUT", { value: "[]" }, otherCookie)).status).toBe(403);
  });
  it("blocks permanent cleanup while a replication remote is configured", async () => {
    expect((await api("/sync/config", "PUT", { deploymentMode: "HYBRID", remoteUrl: "http://127.0.0.1:1", autoSync: false })).status).toBe(200);
    const denied = await api("/maintenance/people", "POST", { kind: "employee", action: "reset", target: "all", ids: [], confirmation: "RESET" });
    expect(denied.status).toBe(409);
    expect((await denied.json()).error).toContain("Disconnect replication");
    expect((await api("/maintenance/people", "POST", { kind: "employee", action: "soft", target: "selected", ids: ["e2"], confirmation: "ARCHIVE" })).status).toBe(200);
  });
  it("restricts the team worksheet to payroll readers and validates its page filters", async () => {
    const path = "/attendance/worksheet?date=2026-10-12&worksiteId=10000000-0000-4000-8000-000000000002&limit=25&offset=0";
    expect((await api(path, "GET", undefined, "")).status).toBe(401);
    const login = await api("/auth/login", "POST", { email: "limited@example.test", password: "TestPassword2026!" }, "");
    expect((await api(path, "GET", undefined, login.headers.get("set-cookie")!.split(";")[0])).status).toBe(403);
    const page = await api(path);
    expect(page.status).toBe(200);
    expect(await page.json()).toEqual({ items: [], total: 0 });
    expect((await api(path.replace("limit=25", "limit=5000"))).status).toBe(400);
  });
  it("creates and cancels preparation runs without allowing overlaps or generic storage writes", async () => {
    const actor = (await (await api("/auth/session")).json()).session.profile.userId;
    const branch = "10000000-0000-4000-8000-000000000008", siteId = "10000000-0000-4000-8000-000000000009", now = new Date().toISOString();
    expect((await api("/storage/coop_sys_organization_directory", "PUT", { value: JSON.stringify({ branches: [{ id: branch, code: "QA", label: "QA", type: "branch", address: "QA", parentId: null, isActive: true }], clients: [], departments: [], positions: [] }) })).status).toBe(200);
    const setup = JSON.parse((await (await api("/storage")).json()).coop_sys_payroll_setup);
    setup.push({ id: siteId, kind: "worksite", data: { label: "Run site", reason: "QA", branch_id: branch, region: "XI", province: "Davao", city: "Davao", category: "Production" }, created_by: actor, created_at: now, updated_at: now, deleted_at: null });
    expect((await api("/storage/coop_sys_payroll_setup", "PUT", { value: JSON.stringify(setup) })).status).toBe(200);
    const input = { title: "Run test", worksite_id: siteId, worksite_label: "Untrusted", payroll_group: "A", frequency: "semi_monthly", period_start: "2026-10-01", period_end: "2026-10-15", pay_date: "2026-10-20", reason: "Client calendar" };
    const created = await api("/payroll/runs", "POST", input); expect(created.status).toBe(201);
    const run = await created.json(); expect(run.worksite_label).toBe("Run site");
    expect((await api("/payroll/runs", "POST", input)).status).toBe(400);
    expect((await (await api(`/payroll/runs/${run.id}/coverage`)).json()).summary.expected).toBe(0);
    expect((await api("/storage/coop_sys_payroll_runs", "PUT", { value: "[]" })).status).toBe(403);
    expect((await api(`/payroll/runs/${run.id}/cancel`, "POST", { reason: "Incorrect calendar" })).status).toBe(200);
    expect((await (await api("/payroll/runs")).json()).total).toBe(0);
    expect((await (await api("/payroll/runs?includeCancelled=true")).json()).items[0].cancel_reason).toBe("Incorrect calendar");
    const login = await api("/auth/login", "POST", { email: "limited@example.test", password: "TestPassword2026!" }, ""), limited = login.headers.get("set-cookie")!.split(";")[0];
    expect((await api("/payroll/runs", "GET", undefined, limited)).status).toBe(403);
    expect((await (await api("/storage", "GET", undefined, limited)).json()).coop_sys_payroll_runs).toBeUndefined();
  });
  it("saves payroll setup batches atomically and refuses unauthorized salary imports", async () => {
    const policy = { kind: "cooperative_policy", data: { label: "Batch default", reason: "Approved", effective_from: "2026-12-01", deduction_centavos: 7500 } };
    const failed = await api("/payroll/setup/batch", "POST", { inputs: [policy, { ...policy, data: { ...policy.data, effective_from: "2026-12-02", deduction_centavos: 0 } }] });
    expect(failed.status).toBe(400);
    const storage = await (await api("/storage")).json();
    expect(JSON.parse(storage.coop_sys_payroll_setup).some((r: { data: { effective_from: string } }) => r.data.effective_from === "2026-12-01")).toBe(false);
    const saved = await api("/payroll/setup/batch", "POST", { inputs: [policy] });
    expect(saved.status).toBe(200); expect(await saved.json()).toMatchObject([{ kind: "cooperative_policy", data: { deduction_centavos: 7500 } }]);
    expect((await api("/payroll/setup/batch", "POST", { inputs: [policy] })).status).toBe(400);
    const login = await api("/auth/login", "POST", { email: "limited@example.test", password: "TestPassword2026!" }, "");
    expect((await api("/payroll/setup/batch", "POST", { inputs: [policy] }, login.headers.get("set-cookie")!.split(";")[0])).status).toBe(403);
    expect((await api("/attendance/worksheet?runId=10000000-0000-4000-8000-000000000099&date=2026-10-01&worksiteId=10000000-0000-4000-8000-000000000009")).status).toBe(400);
  });
  it("saves calculation rule versions atomically and protects private preview sources", async () => {
    const site = "10000000-0000-4000-8000-000000000009";
    const policy = { kind: "policy", worksite_id: site, effective_from: "2026-10-01", payroll_group: "A", regular_minutes: 480, short_day: "block", worked_allowance: "full", reviewed: true, reference: "Approved rule" };
    expect((await api("/payroll/calculation-rules", "POST", [policy])).status).toBe(200);
    const path = `/payroll/calculation-rules?kind=policy&site=${site}`;
    expect((await (await api(path)).json()).total).toBe(1);
    expect((await api("/payroll/calculation-rules", "POST", [policy, { ...policy, regular_minutes: 0 }])).status).toBe(400);
    expect((await (await api(path)).json()).total).toBe(1);
    expect((await api("/storage/coop_sys_payroll_calculation_rules", "PUT", { value: "[]" })).status).toBe(403);
    const created = await api("/payroll/runs", "POST", { title: "Preview source", worksite_id: site, worksite_label: "Site", payroll_group: "A", frequency: "semi_monthly", period_start: "2026-10-01", period_end: "2026-10-15", pay_date: "2026-10-20", reason: "Calendar" });
    const run = await created.json(); expect(created.status).toBe(201);
    const preview = await api(`/payroll/runs/${run.id}/preview`); expect(preview.status).toBe(200);
    expect(await preview.json()).toMatchObject({ rows: [], total: 0 });
    const login = await api("/auth/login", "POST", { email: "limited@example.test", password: "TestPassword2026!" }, ""), cookie = login.headers.get("set-cookie")!.split(";")[0];
    expect((await api(path, "GET", undefined, cookie)).status).toBe(403);
    expect((await api(`/payroll/runs/${run.id}/preview`, "GET", undefined, cookie)).status).toBe(403);
    expect((await (await api("/storage", "GET", undefined, cookie)).json()).coop_sys_payroll_calculation_rules).toBeUndefined();
  });
  it("isolates attendance preferences by authenticated account and rejects forged ownership", async () => {
    expect((await api("/attendance/preferences", "PUT", { blank_mode: "absent" })).status).toBe(200);
    expect(await (await api("/attendance/preferences")).json()).toEqual({ blank_mode: "absent" });
    expect((await api("/attendance/preferences", "PUT", { blank_mode: "present", user_id: "forged" })).status).toBe(400);
    const created = await api("/users", "POST", { display_name: "Payroll reader", email: "payroll-reader@example.test", role: "branch_user", role_ids: ["70000000-0000-4000-8000-000000000007"], branch_ids: [], client_ids: [], scope_type: "organization", direct_grants: ["payroll.view"], direct_denies: [], temporary_password: "TestPassword2026!", is_active: true });
    expect(created.status).toBe(201);
    const login = await api("/auth/login", "POST", { email: "payroll-reader@example.test", password: "TestPassword2026!" }, "");
    const reader = login.headers.get("set-cookie")!.split(";")[0];
    expect(await (await api("/attendance/preferences", "GET", undefined, reader)).json()).toEqual({ blank_mode: "present" });
    expect((await api("/attendance/cutoff", "POST", { runId: "anything", inputs: [] }, reader)).status).toBe(403);
    const limitedLogin = await api("/auth/login", "POST", { email: "limited@example.test", password: "TestPassword2026!" }, "");
    expect((await api("/attendance/preferences", "GET", undefined, limitedLogin.headers.get("set-cookie")!.split(";")[0])).status).toBe(403);
  });
});
