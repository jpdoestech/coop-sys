import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeCleanup, getCleanupPage } from "./maintenanceService";
import type { AccessProfile } from "../access/accessControl";
vi.mock("../../utils/env", () => ({ getAppMode: () => "LOCAL" }));
vi.mock("../server/serverApi", () => ({ usesServerBackend: () => false }));
const admin: AccessProfile = { userId: "user1", role: "super_admin", displayName: "Admin", branchIds: [] };
describe("maintenance access and persistence", () => {
  beforeEach(() => localStorage.clear());
  it("rejects non-super-admin access even with settings.manage", async () => {
    const user = { ...admin, role: "branch_admin", effectivePermissions: ["settings.manage"] };
    await expect(getCleanupPage(user, { kind: "employee" })).rejects.toThrow("Only Super Admin");
    await expect(executeCleanup(user, { kind: "employee", action: "reset", target: "all", ids: [], confirmation: "RESET" })).rejects.toThrow("Only Super Admin");
  });
  it("preserves users, credentials, organization and settings during reset", async () => {
    localStorage.setItem("coop_sys_employees", JSON.stringify([{ id: "e1" }]));
    localStorage.setItem("coop_sys_user_access", JSON.stringify([{ id: "user1", email: "test@example.test", linked_employee_id: "e1" }]));
    localStorage.setItem("coop_sys_auth_credentials", "keep credentials");
    localStorage.setItem("coop_sys_organization_directory", "keep organization");
    localStorage.setItem("coop_sys_payment_ledger", JSON.stringify({ settings: [{ id: "s1" }] }));
    await executeCleanup(admin, { kind: "employee", action: "reset", target: "all", ids: [], confirmation: "RESET" });
    expect(JSON.parse(localStorage.getItem("coop_sys_user_access")!)).toEqual([{ id: "user1", email: "test@example.test", linked_employee_id: null }]);
    expect(localStorage.getItem("coop_sys_auth_credentials")).toBe("keep credentials");
    expect(localStorage.getItem("coop_sys_organization_directory")).toBe("keep organization");
    expect(JSON.parse(localStorage.getItem("coop_sys_payment_ledger")!).settings).toEqual([{ id: "s1" }]);
    expect(JSON.parse(localStorage.getItem("coop_sys_employees")!)).toEqual([]);
  });
  it("rolls back partial browser writes when storage fails", async () => {
    const original = JSON.stringify([{ id: "e1" }]);
    localStorage.setItem("coop_sys_employees", original);
    localStorage.setItem("coop_sys_members", "[]");
    const setItem = Storage.prototype.setItem;
    let failed = false;
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (key === "coop_sys_members" && !failed) { failed = true; throw new Error("Storage full"); }
      setItem.call(this, key, value);
    });
    try {
      await expect(executeCleanup(admin, { kind: "employee", action: "reset", target: "all", ids: [], confirmation: "RESET" })).rejects.toThrow("Storage full");
      expect(localStorage.getItem("coop_sys_employees")).toBe(original);
      expect(localStorage.getItem("coop_sys_members")).toBe("[]");
      expect(localStorage.getItem("coop_sys_maintenance_history")).toBeNull();
    } finally { spy.mockRestore(); }
  });
});
