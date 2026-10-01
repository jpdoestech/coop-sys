import { beforeEach, describe, expect, it } from "vitest";
import type { AccessProfile } from "../../access/accessControl";
import { LocalDashboardRepository } from "./LocalDashboardRepository";

const organizationProfile: AccessProfile = {
  userId: "admin",
  displayName: "System Administrator",
  role: "super_admin",
  branchIds: [],
};

const branchProfile: AccessProfile = {
  userId: "branch-user",
  displayName: "Branch User",
  role: "branch_user",
  branchIds: ["60000000-0000-4000-8000-000000000001"],
};

describe("LocalDashboardRepository", () => {
  beforeEach(() => localStorage.clear());

  it("builds live organization-wide metrics from stored records", async () => {
    const snapshot = await new LocalDashboardRepository().getSnapshot(organizationProfile);

    expect(snapshot.totalMembers).toBe(6);
    expect(snapshot.activeMembers).toBe(5);
    expect(snapshot.pendingApprovals).toBe(1);
    expect(snapshot.totalEmployees).toBe(8);
    expect(snapshot.activeEmployees).toBe(7);
    expect(snapshot.clientDeployed).toBe(5);
    expect(snapshot.directEmployees).toBe(2);
    expect(snapshot.workforceByBranch.map((branch) => branch.branchLabel)).toContain("Head Office");
  });

  it("limits employee, member, and branch totals to assigned branches", async () => {
    const snapshot = await new LocalDashboardRepository().getSnapshot(branchProfile);

    expect(snapshot.totalEmployees).toBe(2);
    expect(snapshot.totalMembers).toBe(1);
    expect(snapshot.workforceByBranch).toHaveLength(1);
    expect(snapshot.workforceByBranch[0].branchLabel).toBe("Davao Branch");
  });
});
