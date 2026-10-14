import { afterEach, describe, expect, it } from "vitest";
import { LocalPayrollRepository } from "./LocalPayrollRepository";
import { LocalOrganizationDirectoryRepository } from "./LocalOrganizationDirectoryRepository";
import { LocalEmployeeRepository } from "./LocalEmployeeRepository";
import type { AccessProfile } from "../../access/accessControl";
import { payrollStorageKey } from "../../payroll/payrollSetup";
import type { PayrollData } from "../../../types/payroll";

const admin: AccessProfile = { userId: "70000000-0000-4000-8000-000000000001", displayName: "Admin", role: "super_admin", scopeType: "organization", branchIds: [] };
afterEach(() => localStorage.clear());
describe("payroll setup storage", () => {
  it("saves a batch atomically and rejects stale patch sources without any changes", async () => {
    const repository = new LocalPayrollRepository(admin);
    const branch = (await new LocalOrganizationDirectoryRepository().getDirectory()).branches[0];
    const employees = await new LocalEmployeeRepository().list({ limit: 2 });
    const site = await repository.save({ kind: "worksite", data: { label: "Batch site", reason: "Setup", branch_id: branch.id, region: "XI", province: "Davao", city: "Davao", category: "Test" } });
    const data: PayrollData = { label: "Terms", reason: "Agreement", worksite_id: site.id, effective_from: "2026-01-01", pay_basis: "daily", rate_centavos: 60000, frequency: "semi_monthly", payroll_group: "A", shift_start: "08:00", shift_end: "17:00", break_minutes: 60, rest_days: [0], allowances: [] };
    const first = (await repository.saveBatch(employees.map((e) => ({ kind: "employee_terms", data: { ...data, employee_id: e.id } }))))[0];
    const before = localStorage.getItem(payrollStorageKey);
    await expect(repository.saveBatch([{ kind: "employee_terms", data: { ...data, employee_id: employees[0].id, effective_from: "2026-02-01" } }, { kind: "employee_terms", data: { ...data, employee_id: employees[1].id } }])).rejects.toThrow("already exists");
    expect(localStorage.getItem(payrollStorageKey)).toBe(before);
    await repository.save({ kind: "employee_terms", data: { ...data, employee_id: employees[0].id, effective_from: "2026-02-01" } });
    const changed = localStorage.getItem(payrollStorageKey);
    await expect(repository.saveBatch([{ kind: "employee_terms", data: { ...data, employee_id: employees[0].id, effective_from: "2026-03-01" }, expected_source_id: first.id }])).rejects.toThrow("terms changed");
    expect(localStorage.getItem(payrollStorageKey)).toBe(changed);
    expect((await repository.list({ kind: "worksite", branchId: branch.id, clientId: null })).items.map((r) => r.id)).toContain(site.id);
    await expect(repository.saveBatch([])).rejects.toThrow("1 and 500");
  });
  it("restricts salary data to explicitly authorized organization-wide users", async () => {
    await expect(new LocalPayrollRepository({ ...admin, role: "hr_manager" }).list({ kind: "employee_terms" })).rejects.toThrow("access");
    await expect(new LocalPayrollRepository({ ...admin, scopeType: "assigned_branches" }).list({ kind: "employee_terms" })).rejects.toThrow("organization-wide");
    await expect(new LocalPayrollRepository({ ...admin, role: "custom", effectivePermissions: ["payroll.view"] }).save({ kind: "worksite", data: { label: "x", reason: "x" } })).rejects.toThrow("access");
  });
  it("preserves history, refuses duplicate effectivity, and prevents archiving an in-use worksite", async () => {
    const repository = new LocalPayrollRepository(admin);
    const branch = (await new LocalOrganizationDirectoryRepository().getDirectory()).branches[0];
    const employee = (await new LocalEmployeeRepository().list({ limit: 1 }))[0];
    const site = await repository.save({ kind: "worksite", data: { label: "Site A", reason: "New location", branch_id: branch.id, region: "XI", province: "Davao del Sur", city: "Davao City", category: "Test" } });
    const terms: PayrollData = { label: "Terms", reason: "Employment agreement", worksite_id: site.id, employee_id: employee.id, effective_from: "2026-01-01", pay_basis: "daily", rate_centavos: 60000, frequency: "semi_monthly", payroll_group: "A", shift_start: "08:00", shift_end: "17:00", break_minutes: 60, rest_days: [0], allowances: [] };
    const first = await repository.save({ kind: "employee_terms", data: terms });
    await expect(repository.save({ kind: "employee_terms", data: terms })).rejects.toThrow("already exists");
    await repository.save({ kind: "employee_terms", data: { ...terms, effective_from: "2026-10-08", rate_centavos: 65000 } });
    expect((await repository.list({ kind: "employee_terms" })).total).toBe(2);
    await expect(repository.archive(site.id)).rejects.toThrow("worksite");
    await repository.archive(first.id);
    expect((await repository.list({ kind: "employee_terms" })).total).toBe(1);
    expect((await repository.list({ kind: "employee_terms", includeArchived: true })).total).toBe(2);
    expect(JSON.parse(localStorage.getItem(payrollStorageKey)!)).toHaveLength(3);
  });
});
