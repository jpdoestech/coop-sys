import { beforeEach, describe, expect, it } from "vitest";
import { LocalUserAccessRepository } from "./LocalUserAccessRepository";

describe("LocalUserAccessRepository", () => {
  beforeEach(() => localStorage.removeItem("coop_sys_user_access"));

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
});
