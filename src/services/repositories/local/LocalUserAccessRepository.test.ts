import { beforeEach, describe, expect, it } from "vitest";
import { LocalUserAccessRepository } from "./LocalUserAccessRepository";

describe("LocalUserAccessRepository", () => {
  beforeEach(() => {
    localStorage.removeItem("coop_sys_user_access");
    localStorage.removeItem("coop_sys_access_roles");
  });

  it("returns filtered users with an exact repository-side total", async () => {
    const repository = new LocalUserAccessRepository();
    const page = await repository.listPage({
      status: "active",
      limit: 1,
      offset: 0,
    });

    expect(page.items).toHaveLength(1);
    expect(page.total).toBeGreaterThanOrEqual(page.items.length);

    const match = await repository.listPage({
      search: page.items[0].email,
      status: "all",
      limit: 10,
    });
    expect(match.total).toBe(1);
    expect(match.items[0].id).toBe(page.items[0].id);
  });

  it("creates and updates a configurable role policy", async () => {
    const repository = new LocalUserAccessRepository();
    const role = await repository.createRole({ code: "payment_encoder", name: "Payment Encoder", description: "Posts branch deductions.", permissions: ["payments.view", "payments.create"], is_active: true });
    expect((await repository.listRoles()).some((item) => item.id === role.id)).toBe(true);
    const updated = await repository.updateRole(role.id, { code: role.code, name: role.name, description: role.description, permissions: ["payments.view"], is_active: false });
    expect(updated.permissions).toEqual(["payments.view"]);
    expect(updated.is_active).toBe(false);
  });
});
