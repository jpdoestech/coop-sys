import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { createRepositories } from "../../../services/repositories/repositoryFactory";
import type { Member } from "../../../types/member";
import { employeeProfileFromMember } from "../../../services/identity/personProfileSync";
import { useAccess } from "../../../services/access/useAccess";
import { assertPermission, employeeIsInScope, hasPermission, isBranchScoped } from "../../../services/access/accessControl";
import { nextPersonNumber } from "../../../services/identity/personNumber";
import { assertImportPlacement, importPersonRows, type PersonImportRequest } from "../../../services/imports/personImportWorkflow";
import { useOrganization } from "../../../services/organization/useOrganization";
import type { ListOptions } from "../../../services/repositories/Repository";
import type { MemberSubmission } from "../types/memberWorkflow";
import { applyMemberPlacement } from "../../../services/identity/memberPlacement";
import { ensureMemberEmployee } from "../../../services/identity/personRegistration";

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
    queryKey: ["next-bod-resolution", profile.userId],
    enabled: hasPermission(profile, "members.approve"),
    queryFn: () => repositories.members.nextApprovalNumber(),
  });

  const saveMember = useMutation({
    mutationFn: async ({ member, submission }: { member: Member | null; submission: MemberSubmission }) => {
      const { input, transfer } = submission;
      assertPermission(profile, member ? "members.update" : "members.create");
      if (member && isBranchScoped(profile)) {
        const linked = await repositories.employees.listByMemberId(member.id);
        if (linked.length ? !linked.some((employee) => employeeIsInScope(employee, profile)) : !member.proposed_branch_id) throw new Error("This member is outside your assigned branches.");
        if (!linked.length) assertImportPlacement(profile, directory, member.proposed_branch_id || "", member.proposed_client_id || "");
      }
      const linkedEmployees = member
        ? (await repositories.employees.listByMemberId(member.id)).filter((employee) => !employee.deleted_at)
        : [];
      if (input.proposed_branch_id) {
        assertImportPlacement(profile, directory, input.proposed_branch_id, input.proposed_client_id || "");
        if (!linkedEmployees.length) assertPermission(profile, "employees.create");
        if ([input.sss_number, input.pagibig_number, input.philhealth_number, input.tax_identification_number].some(Boolean)) assertPermission(profile, "employees.sensitive.update");
      }
      if (!member && isBranchScoped(profile) && !input.proposed_branch_id) throw new Error("Select a deployment within your assigned scope.");
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
      if (!employeesToSynchronize.length) await ensureMemberEmployee(repositories, profile, saved);
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
      for (const id of ids) {
        const member = await repositories.members.getById(id);
        if (member?.bod_approval_status === "pending" && member.proposed_branch_id && !(await repositories.employees.listByMemberId(id)).some((employee) => !employee.deleted_at)) {
          assertImportPlacement(profile, directory, member.proposed_branch_id, member.proposed_client_id || "");
          await ensureMemberEmployee(repositories, profile, member);
        }
      }
      return repositories.members.approve(ids, approvalDate);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["member-options"] });
      queryClient.invalidateQueries({ queryKey: ["next-bod-resolution"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      queryClient.invalidateQueries({ queryKey: ["member-linked-employee"] });
      queryClient.invalidateQueries({ queryKey: ["payment-employees"] });
    },
  });

  const importMembers = useMutation({
    mutationFn: (request: PersonImportRequest) => importPersonRows("member", repositories, profile, directory, request),
    onSuccess: () => { for (const key of ["members", "employees", "member-options", "next-person-number", "next-bod-resolution", "reports", "member-placement-employees", "member-linked-employee", "payment-employees"]) queryClient.invalidateQueries({ queryKey: [key] }); },
  });

  return { query, linkedEmployee, placementEmployees, personNumber, approvalSequence, saveMember, archiveMember, approveMembers, importMembers };
}
