import { afterEach, describe, expect, it } from "vitest";
import { developmentEmployees } from "../../../database/seeds/employeeSeed";
import type { EmployeeInput } from "../../../types/employee";
import { LocalEmployeeRepository } from "./LocalEmployeeRepository";
import { LocalMemberRepository } from "./LocalMemberRepository";
import { employeeIsInScope, type AccessProfile } from "../../access/accessControl";

afterEach(() => localStorage.clear());

describe("LocalEmployeeRepository transfers", () => {
  it("closes the former placement and opens a new history entry", async () => {
    const repository = new LocalEmployeeRepository();
    const employee = developmentEmployees[0];
    const omitted = new Set(["id", "created_at", "updated_at", "deleted_at", "sync_status", "assignment_history"]);
    const input = Object.fromEntries(
      Object.entries(employee).filter(([key]) => !omitted.has(key)),
    ) as unknown as EmployeeInput;
    const transfer = {
      ...input,
      active_assignment: {
        id: "00000000-0000-4000-8000-000000000099",
        branch_id: "60000000-0000-4000-8000-000000000002",
        client_id: "61000000-0000-4000-8000-000000000002",
        assignment_code: "ASN-TRANSFER",
        start_date: "2026-09-28",
        end_date: null,
        work_location: "General Santos Site",
        transfer_reason: "Operational requirement",
        notes: null,
      },
    };

    const saved = await repository.update(employee.id, transfer);

    expect(saved.active_assignment?.id).toBe(transfer.active_assignment.id);
    expect(saved.assignment_history).toHaveLength(2);
    expect(saved.assignment_history.find((item) => item.id === employee.active_assignment?.id)?.end_date).toBe("2026-09-28");
  });

  it("records a member-originated transfer to Head Office and removes former branch visibility", async () => {
    const repository = new LocalEmployeeRepository();
    const members = new LocalMemberRepository();
    const employee = developmentEmployees[1];
    const formerBranch = employee.active_assignment!.branch_id!;
    const headOffice = "60000000-0000-4000-8000-000000000000";
    const saved = await repository.transfer(employee.id, {
      ...employee.active_assignment!,
      id: "00000000-0000-4000-8000-000000000098",
      branch_id: headOffice,
      client_id: null,
      start_date: "2026-10-05",
      work_location: "Head Office",
      transfer_reason: "Reassigned to Head Office",
    }, "member");

    expect(saved.assignment_history).toHaveLength(2);
    expect(saved.active_assignment).toMatchObject({ branch_id: headOffice, client_id: null, transfer_source: "member" });
    expect(saved.work_location).toBe("Head Office");
    expect(await members.getById(employee.member_id!)).toMatchObject({ proposed_branch_id: headOffice, proposed_client_id: null });
    expect((await repository.listPage({ branchId: formerBranch })).items.some((item) => item.id === employee.id)).toBe(false);
    expect((await members.listPage({ branchId: formerBranch })).items.some((item) => item.id === employee.member_id)).toBe(false);
    const branchUser: AccessProfile = { userId: "branch-user", displayName: "Branch user", role: "branch_user", branchIds: [formerBranch], scopeType: "assigned_branches" };
    expect(employeeIsInScope(saved, branchUser)).toBe(false);
  });

  it("keeps placement and history unchanged when a transfer is invalid", async () => {
    const repository = new LocalEmployeeRepository();
    const employee = developmentEmployees[0];
    const before = await repository.getById(employee.id);
    await expect(repository.transfer(employee.id, {
      ...employee.active_assignment!,
      id: "00000000-0000-4000-8000-000000000098",
      branch_id: "60000000-0000-4000-8000-000000000002",
      start_date: "2026-10-05",
      transfer_reason: "",
    })).rejects.toThrow("A transfer reason is required.");
    expect(await repository.getById(employee.id)).toEqual(before);
  });
});

