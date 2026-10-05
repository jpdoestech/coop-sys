import { afterEach, describe, expect, it, vi } from "vitest";
import { LocalEmployeeRepository } from "../repositories/local/LocalEmployeeRepository";
import { LocalMemberRepository } from "../repositories/local/LocalMemberRepository";
import { branches, clients } from "../lookups/organization";
import { departments, positions } from "../../features/employees/data/employeeOptions";
import type { OrganizationDirectory } from "../../types/organization";
import type { AccessProfile } from "../access/accessControl";
import { personRowsFromSpreadsheet } from "./personImport";
import { assertImportPlacement, importPersonRows } from "./personImportWorkflow";
import { applyMemberPlacement } from "../identity/memberPlacement";
import type { MemberInput } from "../../types/member";
import type { SpreadsheetRow } from "./excelWorkbook";

const directory: OrganizationDirectory = { branches, clients, departments: departments.map((item) => ({ ...item, code: "", description: "", isActive: true })), positions: positions.map((item) => ({ ...item, code: "", description: "", isActive: true })) };
const admin: AccessProfile = { userId: "admin", displayName: "Admin", role: "super_admin", branchIds: [], scopeType: "organization" };
afterEach(() => localStorage.clear());

describe("person import workflow", () => {
  it("filters persisted attention flags before pagination", async () => {
    const repositories = { members: new LocalMemberRepository(), employees: new LocalEmployeeRepository() };
    const rows = await personRowsFromSpreadsheet([{ "FIRST NAME": "Review", "LAST NAME": "Unmapped", DEPARTMENT: "Custom division" }, { "FIRST NAME": "Clean", "LAST NAME": "Import" }]);
    const results = await importPersonRows("employee", repositories, admin, directory, { rows, branchId: branches[0].id, clientId: "" });
    expect(results.map((item) => item.status)).toEqual(["imported", "imported"]);
    const page = await repositories.employees.listPage({ attentionOnly: true, limit: 1, offset: 0 });
    expect(page.total).toBe(1);
    expect(page.items[0]).toMatchObject({ pending_department_name: "Custom division", import_attention: { DEPARTMENT: "Custom division" } });
    expect((await repositories.employees.listPage({ attentionOnly: true, limit: 1, offset: 1 })).items).toEqual([]);
  });
  it("rejects existing-name, email and government-ID duplicates before creating a person", async () => {
    const repositories = { members: new LocalMemberRepository(), employees: new LocalEmployeeRepository() };
    const [original] = await personRowsFromSpreadsheet([{ "FIRST NAME": "Existing", "LAST NAME": "Identity", EMAIL: "existing@example.test", "SSS NUMBER": "987654321" }]);
    await importPersonRows("employee", repositories, admin, directory, { rows: [original], branchId: branches[0].id, clientId: "" });
    const duplicates: SpreadsheetRow[] = [{ "FIRST NAME": "Existing", "LAST NAME": "Identity" }, { "FIRST NAME": "Email", "LAST NAME": "Duplicate", EMAIL: "EXISTING@example.test" }, { "FIRST NAME": "Government", "LAST NAME": "Duplicate", "SSS NUMBER": "98-765432-1" }];
    for (const fields of duplicates) {
      const rows = await personRowsFromSpreadsheet([fields]);
      const [result] = await importPersonRows("employee", repositories, admin, directory, { rows, branchId: branches[0].id, clientId: "" });
      expect(result).toMatchObject({ status: "error", errorType: "duplicate" });
    }
  });
  it("creates the missing initial assignment when intended placement is saved from a member", async () => {
    const repositories = { members: new LocalMemberRepository(), employees: new LocalEmployeeRepository() };
    const [memberRow] = await personRowsFromSpreadsheet([{ "FIRST NAME": "Initial", "LAST NAME": "Placement" }], "member");
    const member = await repositories.members.create({ ...memberRow.memberFields, membership_number: "000099", proposed_branch_id: branches[1].id, proposed_client_id: clients[0].id } as MemberInput);
    const [row] = await personRowsFromSpreadsheet([{ "FIRST NAME": "Initial", "LAST NAME": "Placement", "DATE HIRED": "2025-01-15" }]);
    const employee = await repositories.employees.create({ ...row.employeeFields, employee_number: member.membership_number, member_id: member.id, active_assignment: null } as Parameters<LocalEmployeeRepository['create']>[0]);
    await applyMemberPlacement(repositories.employees, employee, member as MemberInput);
    const saved = (await repositories.employees.getById(employee.id))!;
    expect(saved.active_assignment).toMatchObject({ branch_id: branches[1].id, client_id: clients[0].id, start_date: "2025-01-15", transfer_reason: "Initial deployment from member record" });
    expect(saved.assignment_history).toHaveLength(1);
    expect((await repositories.employees.listPage({ branchId: branches[1].id })).items.some((item) => item.id === employee.id)).toBe(true);
  });
  it("creates the employee assignment and preserves full imported data in the list", async () => {
    const repositories = { members: new LocalMemberRepository(), employees: new LocalEmployeeRepository() };
    const rows = await personRowsFromSpreadsheet([{ "FIRST NAME": "New", "LAST NAME": "Employee", "DATE HIRED": "1/15/2025", "SSS NUMBER": "123456789", ADDRESS: "Full address" }]);
    const results = await importPersonRows("employee", repositories, admin, directory, { rows, branchId: branches[1].id, clientId: clients[0].id });
    expect(results[0].status).toBe("imported");
    const saved = await repositories.employees.getById(results[0].recordId!);
    expect(saved).toMatchObject({ sss_number: "12-345678-9", address: "Full address", active_assignment: { branch_id: branches[1].id, client_id: clients[0].id, start_date: "2025-01-15" } });
    expect((await repositories.employees.listPage({ branchId: branches[1].id, clientId: clients[0].id })).items.some((item) => item.id === saved!.id)).toBe(true);
  });
  it("rejects forged or missing client assignments for client-scoped users", () => {
    const profile: AccessProfile = { ...admin, role: "branch_user", scopeType: "assigned_clients", branchIds: [branches[1].id], clientIds: [clients[0].id] };
    expect(() => assertImportPlacement(profile, directory, branches[1].id, clients[0].id)).not.toThrow();
    expect(() => assertImportPlacement(profile, directory, branches[1].id, "")).toThrow("assigned clients");
    expect(() => assertImportPlacement(profile, directory, branches[2].id, clients[1].id)).toThrow("assigned scope");
    expect(() => assertImportPlacement(admin, directory, branches[0].id, clients[0].id)).toThrow("selected branch");
  });
  it("keeps imported and duplicate results separate without losing successful rows", async () => {
    const repositories = { members: new LocalMemberRepository(), employees: new LocalEmployeeRepository() };
    const rows = await personRowsFromSpreadsheet([{ "FIRST NAME": "New", "LAST NAME": "One" }, { ID: "000001", "FIRST NAME": "Duplicate", "LAST NAME": "One" }]);
    const results = await importPersonRows("employee", repositories, admin, directory, { rows, branchId: branches[0].id, clientId: "" });
    expect(results.map((item) => item.status)).toEqual(["imported", "error"]);
    expect(results[1].errorType).toBe("duplicate");
  });
  it("sets initial member-linked deployment and records subsequent placement changes as transfers", async () => {
    const repositories = { members: new LocalMemberRepository(), employees: new LocalEmployeeRepository() };
    const [row] = await personRowsFromSpreadsheet([{ "FIRST NAME": "Linked", "LAST NAME": "Employee" }]);
    const employee = await repositories.employees.create({ ...row.employeeFields, employee_number: "000099", member_id: null, active_assignment: null } as Parameters<LocalEmployeeRepository['create']>[0]);
    const [memberRow] = await personRowsFromSpreadsheet([{ ID: "99", "FIRST NAME": "Linked", "LAST NAME": "Employee" }], "member");
    const results = await importPersonRows("member", repositories, admin, directory, { rows: [memberRow], branchId: branches[1].id, clientId: clients[0].id });
    expect(results[0].status).toBe("imported");
    const assigned = (await repositories.employees.getById(employee.id))!;
    expect(assigned.member_id).toBe(results[0].recordId);
    expect(assigned.active_assignment).toMatchObject({ branch_id: branches[1].id, client_id: clients[0].id });
    const member = (await repositories.members.getById(results[0].recordId!))!;
    await applyMemberPlacement(repositories.employees, assigned, { ...member, proposed_branch_id: branches[0].id, proposed_client_id: null } as MemberInput, { effectiveDate: "2026-10-05", reason: "Move to head office", workLocation: "Head Office" });
    const transferred = (await repositories.employees.getById(employee.id))!;
    expect(transferred.assignment_history).toHaveLength(2);
    expect(transferred.active_assignment).toMatchObject({ branch_id: branches[0].id, client_id: null, transfer_source: "member" });
    expect(await repositories.members.getById(member.id)).toMatchObject({ proposed_branch_id: branches[0].id, proposed_client_id: null });
  });
  it("does not report a partially saved member as safely retryable", async () => {
    const repositories = { members: new LocalMemberRepository(), employees: new LocalEmployeeRepository() };
    const [row] = await personRowsFromSpreadsheet([{ "FIRST NAME": "Linked", "LAST NAME": "Employee" }]);
    await repositories.employees.create({ ...row.employeeFields, employee_number: "000099", member_id: null, active_assignment: null } as Parameters<LocalEmployeeRepository['create']>[0]);
    vi.spyOn(repositories.employees, "update").mockRejectedValueOnce(new Error("Connection lost"));
    const rows = await personRowsFromSpreadsheet([{ ID: "99", "FIRST NAME": "Linked", "LAST NAME": "Employee" }], "member");
    const [result] = await importPersonRows("member", repositories, admin, directory, { rows, branchId: branches[0].id, clientId: "" });
    expect(result).toMatchObject({ status: "error", errorType: "save", recordId: expect.any(String) });
    expect(result.message).toContain("do not re-import");
  });
});
