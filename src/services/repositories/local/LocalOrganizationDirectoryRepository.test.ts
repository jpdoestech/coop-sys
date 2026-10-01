import { beforeEach, describe, expect, it } from "vitest";
import { LocalOrganizationDirectoryRepository } from "./LocalOrganizationDirectoryRepository";

describe("LocalOrganizationDirectoryRepository", () => {
  beforeEach(() => localStorage.removeItem("coop_sys_organization_directory"));

  it("persists branch-owned clients and rejects duplicate codes", async () => {
    const repository = new LocalOrganizationDirectoryRepository();
    const directory = await repository.getDirectory();
    const branch = directory.branches.find((item) => item.type === "branch")!;
    await repository.saveClient({
      id: crypto.randomUUID(),
      code: "CLIENT-C",
      label: "Sample Service Client",
      branchId: branch.id,
      address: "Davao City",
      contactPerson: "",
      contactDetails: "",
      isActive: true,
    });
    expect(
      (await repository.getDirectory()).clients.some(
        (item) => item.code === "CLIENT-C" && item.branchId === branch.id,
      ),
    ).toBe(true);
    await expect(
      repository.saveClient({
        id: crypto.randomUUID(),
        code: "CLIENT-C",
        label: "Another Client",
        branchId: branch.id,
        address: "",
        contactPerson: "",
        contactDetails: "",
        isActive: true,
      }),
    ).rejects.toThrow("Code already exists");
  });

  it("filters and paginates organization records in the repository", async () => {
    const repository = new LocalOrganizationDirectoryRepository();
    const page = await repository.listRecords("branch", {
      status: "active",
      limit: 1,
      offset: 0,
    });

    expect(page.items).toHaveLength(1);
    expect(page.total).toBeGreaterThanOrEqual(2);
  });
});
