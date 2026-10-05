import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { createRepositories } from "../../../services/repositories/repositoryFactory";
import type { Member } from "../../../types/member";
import { employeeProfileFromMember } from "../../../services/identity/personProfileSync";
import { useAccess } from "../../../services/access/useAccess";
import { assertPermission, employeeIsInScope, isBranchScoped } from "../../../services/access/accessControl";
import { nextPersonNumber } from "../../../services/identity/personNumber";
import { nextBodResolutionNumber } from "../../../services/members/membershipApproval";
import { MEMBER_STATUS } from "../../../services/lookups/statuses";
import { assertImportPlacement, importPersonRows, type PersonImportRequest } from "../../../services/imports/personImportWorkflow";
import { useOrganization } from "../../../services/organization/useOrganization";
import type { ListOptions } from "../../../services/repositories/Repository";
import type { MemberSubmission } from "../types/memberWorkflow";
import { applyMemberPlacement } from "../../../services/identity/memberPlacement";

export function useMembers(options: ListOptions, editingMemberId?: string | null) {
  const repositories = useMemo(() => createRepositories(), []);
  const queryClient = useQueryClient();
  const { profile } = useAccess();
  const directory = useOrganization();
  const queryKey = ["members", "page", options];

  const query = useQuery({
    queryKey,
    refetchInterval: 30000,
    queryFn: async () => {
      return repositories.members.listPage(options);
    }
  });
  const placementEmployees = useQuery({
    queryKey: ["member-placement-employees"],
    queryFn: async () => (await repositories.employees.list({ limit: 1000 })).filter((employee) => employeeIsInScope(employee, profile)),
  });
  const linkedEmployee = useQuery({
    queryKey: ["member-linked-employee", profile.userId, editingMemberId],
    enabled: Boolean(editingMemberId),
    queryFn: async () => (await repositories.employees.listByMemberId(editingMemberId!)).find((employee) => !employee.deleted_at && employeeIsInScope(employee, profile)) ?? null,
  });
  const personNumber = useQuery({
    queryKey: ["next-person-number"],
    queryFn: async () => nextPersonNumber(
      await repositories.members.list({ includeDeleted: true, limit: 10000 }),
      await repositories.employees.list({ includeDeleted: true, limit: 10000 }),
    ),
  });
  const approvalSequence = useQuery({
    queryKey: ["next-bod-resolution"],
    queryFn: async () => nextBodResolutionNumber(await repositories.members.list({ limit: 10000 })),
  });

  const saveMember = useMutation({
    mutationFn: async ({ member, submission }: { member: Member | null; submission: MemberSubmission }) => {
      const { input, transfer } = submission;
      assertPermission(profile, member ? "members.update" : "members.create");
      if (!member && isBranchScoped(profile)) throw new Error("Create branch members from the employee workflow so their branch scope is recorded.");
      if (member && isBranchScoped(profile)) {
        const linked = await repositories.employees.listByMemberId(member.id);
        if (!linked.some((employee) => employeeIsInScope(employee, profile))) throw new Error("This member is outside your assigned branches.");
      }
      const linkedEmployees = member
        ? (await repositories.employees.listByMemberId(member.id)).filter((employee) => !employee.deleted_at)
        : [];
      const employeesNeedingTransfer = linkedEmployees.filter((employee) =>
        (!employee.active_assignment && !employee.assignment_history.length) || employee.active_assignment &&
        (employee.active_assignment.branch_id !== input.proposed_branch_id || employee.active_assignment.client_id !== input.proposed_client_id),
      );
      if (employeesNeedingTransfer.length) {
        assertPermission(profile, "employees.update");
        assertImportPlacement(profile, directory, input.proposed_branch_id || "", input.proposed_client_id || "");
        await Promise.all(employeesNeedingTransfer.map((employee) => applyMemberPlacement(repositories.employees, employee, input, transfer || undefined)));
      }
      const saved = member
        ? await repositories.members.update(member.id, input)
        : await repositories.members.create({ ...input, membership_number: personNumber.data ?? input.membership_number });
      const employeesToSynchronize = member
        ? linkedEmployees
        : await repositories.employees.listByMemberId(saved.id);
      await Promise.all(
        employeesToSynchronize.map((linkedEmployee) =>
          repositories.employees.update(linkedEmployee.id, employeeProfileFromMember(saved)),
        ),
      );
      return saved;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["member-options"] });
      queryClient.invalidateQueries({ queryKey: ["next-bod-resolution"] });
      queryClient.invalidateQueries({ queryKey: ["next-person-number"] });
      queryClient.invalidateQueries({ queryKey: ["member-placement-employees"] });
      queryClient.invalidateQueries({ queryKey: ["member-linked-employee"] });
      queryClient.invalidateQueries({ queryKey: ["payment-employees"] });
      queryClient.invalidateQueries({ queryKey: ["payment-ledger"] });
    }
  });

  const archiveMember = useMutation({
    mutationFn: async (id: string) => {
      assertPermission(profile, "members.delete");
      if (isBranchScoped(profile)) {
        const linked = await repositories.employees.listByMemberId(id);
        if (!linked.some((employee) => employeeIsInScope(employee, profile))) throw new Error("This member is outside your assigned branches.");
      }
      return repositories.members.archive(id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["members"] })
  });

  const approveMembers = useMutation({
    mutationFn: async ({ ids, approvalDate }: { ids: string[]; approvalDate: string }) => {
      assertPermission(profile, "members.approve");
      if (!ids.length) throw new Error("Select at least one pending member.");
      const allMembers = await repositories.members.list({ limit: 10000 });
      const selected = allMembers.filter((member) => ids.includes(member.id));
      if (selected.length !== ids.length || selected.some((member) => member.bod_approval_status !== "pending")) {
        throw new Error("Only pending membership applications can be approved.");
      }
      const resolutionNumber = nextBodResolutionNumber(allMembers);
      await Promise.all(selected.map(async (member) => {
        const saved = await repositories.members.update(member.id, {
          bod_approval_status: "approved",
          acceptance_date: approvalDate,
          acceptance_resolution_number: resolutionNumber,
          membership_status_id: MEMBER_STATUS.active,
        });
        const linkedEmployees = await repositories.employees.listByMemberId(saved.id);
        await Promise.all(linkedEmployees.map((employee) => repositories.employees.update(employee.id, employeeProfileFromMember(saved))));
      }));
      return resolutionNumber;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["member-options"] });
    },
  });

  const importMembers = useMutation({
    mutationFn: (request: PersonImportRequest) => importPersonRows("member", repositories, profile, directory, request),
    onSuccess: () => { for (const key of ["members", "employees", "member-options", "next-person-number", "member-placement-employees", "member-linked-employee", "payment-employees"]) queryClient.invalidateQueries({ queryKey: [key] }); },
  });

  return { query, linkedEmployee, placementEmployees, personNumber, approvalSequence, saveMember, archiveMember, approveMembers, importMembers };
}
