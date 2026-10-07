import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocalMemberRepository } from "../repositories/local/LocalMemberRepository";
import { LocalEmployeeRepository } from "../repositories/local/LocalEmployeeRepository";
import { personRowsFromSpreadsheet } from "../imports/personImport";
import { ensureMemberEmployee } from "../identity/personRegistration";
import type { MemberInput } from "../../types/member";
import type { AccessProfile } from "../access/accessControl";
import { branches } from "../lookups/organization";

const admin: AccessProfile = { userId: "admin", displayName: "Admin", role: "super_admin", branchIds: [], scopeType: "organization" };
beforeEach(() => { localStorage.clear(); localStorage.setItem("coop_sys_members", "[]"); localStorage.setItem("coop_sys_employees", "[]"); });
afterEach(() => localStorage.clear());
async function pending(repository: LocalMemberRepository, number: string) {
  const [row] = await personRowsFromSpreadsheet([{ "FIRST NAME": "Pending", "LAST NAME": number }], "member");
  return repository.create({ ...row.memberFields, membership_number: number, proposed_branch_id: branches[0].id, proposed_client_id: null } as MemberInput);
}

describe("BOD approval numbering", () => {
  it("does not reuse a resolution across simultaneous approval requests", async () => {
    const members = new LocalMemberRepository();
    const first = await pending(members, "000001"), second = await pending(members, "000002");
    expect(await Promise.all([members.approve([first.id], "2026-10-07"), members.approve([second.id], "2026-10-07")])).toEqual(["000001", "000002"]);
  });
  it("assigns one number per batch and advances the next preview", async () => {
    const members = new LocalMemberRepository(), employees = new LocalEmployeeRepository();
    const first = await pending(members, "000001"), second = await pending(members, "000002"), third = await pending(members, "000003");
    await ensureMemberEmployee({ members, employees }, admin, first);
    expect(await members.nextApprovalNumber()).toBe("000001");
    expect(await members.approve([first.id, second.id], "2026-10-07")).toBe("000001");
    for (const id of [first.id, second.id]) expect(await members.getById(id)).toMatchObject({ bod_approval_status: "approved", acceptance_date: "2026-10-07", acceptance_resolution_number: "000001" });
    expect((await employees.listByMemberId(first.id))[0].employment_status_id).toBe("33000000-0000-4000-8000-000000000001");
    expect(await members.nextApprovalNumber()).toBe("000002");
    expect(await members.approve([third.id], "2026-10-08")).toBe("000002");
    expect(await members.nextApprovalNumber()).toBe("000003");
  });
  it("does not consume numbers for failed approval or reuse numbers after record deletion", async () => {
    const members = new LocalMemberRepository(), first = await pending(members, "000001");
    await expect(members.approve([first.id, "missing"], "2026-10-07")).rejects.toThrow("pending");
    await expect(members.approve([first.id], "2026-02-30")).rejects.toThrow("valid approval date");
    expect(await members.nextApprovalNumber()).toBe("000001");
    await members.approve([first.id], "2026-10-07");
    await expect(members.approve([first.id], "2026-10-07")).rejects.toThrow("pending");
    localStorage.setItem("coop_sys_members", "[]");
    expect(await members.nextApprovalNumber()).toBe("000002");
  });
});
