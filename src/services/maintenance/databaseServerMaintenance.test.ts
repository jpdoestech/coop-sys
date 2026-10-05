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
    const template = readFileSync(resolve("tools/database-server/server-template.cjs"), "utf8").replace("__COOP_EMBEDDED_ASSETS__", "{}").replace("__COOP_MAINTENANCE__", `(() => { const exports = {}; ${code}; return exports; })()`);
    const serverPath = join(directory, "test-server.cjs");
    writeFileSync(serverPath, template.replace('const port = Number(args.port || 8787);', 'const port = 0;').replace('console.log(`READY|${port}|', 'console.log(`READY|${server.address().port}|'));
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
    const list = await api("/maintenance/people?kind=employee&limit=1&offset=1&state=active");
    expect(await list.json()).toMatchObject({ total: 2, items: [{ id: "e2" }] });
    const result = await api("/maintenance/people", "POST", { kind: "employee", action: "hard", target: "selected", ids: ["e1"], confirmation: "wrong" });
    expect(result.status).toBe(400);
    const unchanged = await api("/maintenance/people?kind=employee&state=all");
    expect((await unchanged.json()).total).toBe(2);
  });
  it("rejects non-super-admin API calls even with settings permissions", async () => {
    const created = await api("/users", "POST", { display_name: "Limited test", email: "limited@example.test", role: "branch_user", role_ids: ["70000000-0000-4000-8000-000000000007"], branch_ids: [], client_ids: [], scope_type: "organization", direct_grants: ["settings.manage"], temporary_password: "TestPassword2026!", is_active: true });
    expect(created.status).toBe(201);
    const login = await api("/auth/login", "POST", { email: "limited@example.test", password: "TestPassword2026!" }, "");
    const limitedCookie = login.headers.get("set-cookie")!.split(";")[0];
    expect((await api("/maintenance/people?kind=employee", "GET", undefined, limitedCookie)).status).toBe(403);
    expect((await api("/maintenance/people", "POST", { kind: "employee", action: "reset", target: "all", ids: [], confirmation: "RESET" }, limitedCookie)).status).toBe(403);
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
  it("blocks permanent cleanup while a replication remote is configured", async () => {
    expect((await api("/sync/config", "PUT", { deploymentMode: "HYBRID", remoteUrl: "http://127.0.0.1:1", autoSync: false })).status).toBe(200);
    const denied = await api("/maintenance/people", "POST", { kind: "employee", action: "reset", target: "all", ids: [], confirmation: "RESET" });
    expect(denied.status).toBe(409);
    expect((await denied.json()).error).toContain("Disconnect replication");
    expect((await api("/maintenance/people", "POST", { kind: "employee", action: "soft", target: "selected", ids: ["e2"], confirmation: "ARCHIVE" })).status).toBe(200);
  });
});
