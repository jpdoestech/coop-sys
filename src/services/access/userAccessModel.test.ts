import { describe, expect, it } from "vitest";
import { createDefaultRoles } from "./accessControl";
import { accessProfileForUser, defaultRoleId, normalizeSystemUser } from "./userAccessModel";

describe("user access model", () => {
  it("upgrades legacy single-role users without losing their branch scope", () => {
    const user = normalizeSystemUser({ id: "user-1", display_name: "Branch User", email: "branch@example.test", role: "branch_user", branch_ids: ["branch-1"] });
    expect(user.role_ids).toEqual([defaultRoleId("branch_user")]);
    expect(user.scope_type).toBe("assigned_branches");
  });

  it("combines multiple roles and gives direct denies final precedence", () => {
    const roles = createDefaultRoles();
    const user = normalizeSystemUser({ id: "user-2", display_name: "Operator", email: "operator@example.test", role: "branch_user", role_ids: [defaultRoleId("branch_user"), defaultRoleId("accounting_manager")], branch_ids: ["branch-1"], direct_grants: ["payments.create"], direct_denies: ["payments.export"] });
    const profile = accessProfileForUser(user, roles);
    expect(profile.effectivePermissions).toContain("payments.create");
    expect(profile.effectivePermissions).not.toContain("payments.export");
    expect(profile.roleLabels).toHaveLength(2);
  });
});
