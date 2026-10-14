import { afterEach, describe, expect, it, vi } from "vitest";
import { loadAttendancePreferences, saveAttendancePreferences } from "./attendancePreferences";
import type { AccessProfile } from "../access/accessControl";
vi.mock("../../utils/env", () => ({ getAppMode: () => "OFFLINE" }));
const profile: AccessProfile = { userId: "account-a", displayName: "A", role: "super_admin", branchIds: [], scopeType: "organization" };
afterEach(() => localStorage.clear());
describe("per-account attendance preferences", () => {
  it("persists a user's blank mode without changing another account's defaults", async () => {
    expect(await loadAttendancePreferences(profile)).toEqual({ blank_mode: "present" });
    await saveAttendancePreferences(profile, { blank_mode: "absent" });
    expect(await loadAttendancePreferences(profile)).toEqual({ blank_mode: "absent" });
    expect(await loadAttendancePreferences({ ...profile, userId: "account-b" })).toEqual({ blank_mode: "present" });
  });
  it("rejects unauthorized users and invalid values", async () => {
    await expect(loadAttendancePreferences({ ...profile, role: "branch_user" })).rejects.toThrow("access");
    await expect(saveAttendancePreferences(profile, { blank_mode: "unknown" as "present" })).rejects.toThrow("Select");
  });
});
