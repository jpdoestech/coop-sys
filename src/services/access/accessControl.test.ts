import { describe, expect, it } from "vitest";
import { branchIsInScope, employeeIsInScope, hasPermission, type AccessProfile } from "./accessControl";
import type { Employee } from "../../types/employee";

const branchId = "60000000-0000-4000-8000-000000000001";
const profile: AccessProfile = { userId: "1", displayName: "Branch User", role: "branch_user", branchIds: [branchId] };

describe("access control", () => {
  it("reserves user management for Super Admin", () => {
    expect(hasPermission(profile, "users.manage")).toBe(false);
    expect(hasPermission({ ...profile, role: "super_admin" }, "users.manage")).toBe(true);
  });

  it("limits branch roles to their assigned branch", () => {
    expect(branchIsInScope(branchId, profile)).toBe(true);
    expect(branchIsInScope("60000000-0000-4000-8000-000000000002", profile)).toBe(false);
    const employee = { active_assignment: { branch_id: branchId } } as Employee;
    expect(employeeIsInScope(employee, profile)).toBe(true);
    expect(employeeIsInScope({ ...employee, active_assignment: { ...employee.active_assignment!, branch_id: "60000000-0000-4000-8000-000000000002" } }, profile)).toBe(false);
  });
});

