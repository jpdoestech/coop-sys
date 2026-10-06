// @vitest-environment node
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sqliteReportPage } from "./sqliteReports";

let db: DatabaseSync;
const scope = { scopeType: "organization", branchIds: [], clientIds: [] };
beforeEach(() => {
  db = new DatabaseSync(":memory:");
  db.exec("create table app_storage(storage_key text primary key,value text)");
  const write = (key: string, value: unknown) => db.prepare("insert into app_storage values(?,?)").run(key, JSON.stringify(value));
  write("coop_sys_organization_directory", { branches: [{ id: "A", label: "Alpha" }, { id: "B", label: "Beta" }], clients: [{ id: "C", label: "Client", branchId: "A" }], departments: [], positions: [] });
  write("coop_sys_employees", [
    { id: "e1", employee_number: "000001", member_id: "m1", first_name: "Transferred", last_name: "Person", employment_status_id: "33000000-0000-4000-8000-000000000001", date_hired: "2021-01-01", active_assignment: { branch_id: "B", client_id: null }, sss_number: "private" },
    { id: "e2", employee_number: "000002", member_id: "m2", first_name: "Current", last_name: "Person", employment_status_id: "33000000-0000-4000-8000-000000000001", date_hired: "2025-01-01", active_assignment: { branch_id: "A", client_id: "C" }, import_attention: { DEPARTMENT: "Unknown" } },
    { id: "e3", employee_number: "000003", first_name: "Deleted", deleted_at: "2026-01-01" },
  ]);
  write("coop_sys_members", [{ id: "m1", membership_number: "000001", first_name: "Transferred", last_name: "Person", proposed_branch_id: "A", membership_status_id: "31000000-0000-4000-8000-000000000001", bod_approval_status: "approved" }, { id: "m2", membership_number: "000002", first_name: "Current", last_name: "Person", proposed_branch_id: "A", proposed_client_id: "C", bod_approval_status: "pending", import_attention: { SEX: "Custom" } }]);
});
afterEach(() => db.close());
describe("SQLite report database pagination", () => {
  it("counts before paging and never projects government IDs", () => {
    const page = sqliteReportPage(db, { kind: "employees", limit: 1, offset: 1 }, scope);
    expect(page.total).toBe(2); expect(page.records).toBe(2); expect(page.items).toHaveLength(1); expect(page.active).toBe(2);
    expect(JSON.stringify(page)).not.toContain("private"); expect(page.items[0]).not.toHaveProperty("sss_number");
  });
  it("enforces current branch/client and self scopes before count and grouping", () => {
    const assigned = { scopeType: "assigned_branches", branchIds: ["A"], clientIds: [] };
    expect(sqliteReportPage(db, { kind: "members" }, assigned).items.map((item) => item.id)).toEqual(["m2"]);
    expect(sqliteReportPage(db, { kind: "deployment" }, assigned)).toMatchObject({ total: 1, records: 1, items: [{ employees: 1, clientDeployed: 1 }] });
    expect(sqliteReportPage(db, { kind: "employees" }, { ...scope, scopeType: "self", linkedEmployeeId: "e1" }).total).toBe(1);
    expect(sqliteReportPage(db, { kind: "employees" }, { ...scope, scopeType: "assigned_clients", clientIds: ["C"] }).total).toBe(1);
    expect(sqliteReportPage(db, { kind: "members" }, { ...scope, scopeType: "assigned_branches" }).total).toBe(0);
  });
  it("filters dates, review flags, literal search and rejects sort injection", () => {
    expect(sqliteReportPage(db, { kind: "employees", attentionOnly: true, dateFrom: "2025-01-01" }, scope)).toMatchObject({ total: 1, attention: 1 });
    expect(sqliteReportPage(db, { kind: "employees", search: "%" }, scope).total).toBe(0);
    expect(() => sqliteReportPage(db, { kind: "employees", sort: 'name;drop table app_storage' as never }, scope)).toThrow();
  });
});
