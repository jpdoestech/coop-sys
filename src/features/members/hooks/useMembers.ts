import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { createRepositories } from "../../../services/repositories/repositoryFactory";
import type { Member, MemberInput } from "../../../types/member";
import { employeeProfileFromMember } from "../../../services/identity/personProfileSync";
import { useAccess } from "../../../services/access/useAccess";
import { assertPermission, employeeIsInScope, isBranchScoped } from "../../../services/access/accessControl";
import { nextPersonNumber } from "../../../services/identity/personNumber";
import { nextBodResolutionNumber } from "../../../services/members/membershipApproval";
import { MEMBER_STATUS } from "../../../services/lookups/statuses";

export function useMembers(search: string) {
  const repositories = useMemo(() => createRepositories(), []);
  const queryClient = useQueryClient();
  const { profile } = useAccess();
  const queryKey = ["members", search];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const members = await repositories.members.list({ search, limit: 100 });
      if (!isBranchScoped(profile)) return members;
      const employees = await repositories.employees.list({ limit: 500 });
      const visibleIds = new Set(employees.filter((employee) => employeeIsInScope(employee, profile)).map((employee) => employee.member_id));
      return members.filter((member) => visibleIds.has(member.id));
    }
  });
  const placementEmployees = useQuery({
    queryKey: ["member-placement-employees"],
    queryFn: async () => (await repositories.employees.list({ limit: 1000 })).filter((employee) => employeeIsInScope(employee, profile)),
  });
  const personNumber = useQuery({
    queryKey: ["next-person-number"],
    queryFn: async () => nextPersonNumber(
      await repositories.members.list({ limit: 10000 }),
      await repositories.employees.list({ limit: 10000 }),
    ),
  });
  const approvalSequence = useQuery({
    queryKey: ["next-bod-resolution"],
    queryFn: async () => nextBodResolutionNumber(await repositories.members.list({ limit: 10000 })),
  });

  const saveMember = useMutation({
    mutationFn: async ({ member, input }: { member: Member | null; input: MemberInput }) => {
      assertPermission(profile, "members.manage");
      if (!member && isBranchScoped(profile)) throw new Error("Create branch members from the employee workflow so their branch scope is recorded.");
      if (member && isBranchScoped(profile)) {
        const linked = await repositories.employees.listByMemberId(member.id);
        if (!linked.some((employee) => employeeIsInScope(employee, profile))) throw new Error("This member is outside your assigned branches.");
      }
      const saved = member
        ? await repositories.members.update(member.id, input)
        : await repositories.members.create({ ...input, membership_number: personNumber.data ?? input.membership_number });
      const linkedEmployees = await repositories.employees.listByMemberId(saved.id);
      await Promise.all(
        linkedEmployees.map((linkedEmployee) =>
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
    }
  });

  const archiveMember = useMutation({
    mutationFn: async (id: string) => {
      assertPermission(profile, "members.manage");
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
      assertPermission(profile, "members.manage");
      if (!ids.length) throw new Error("Select at least one pending member.");
      const allMembers = await repositories.members.list({ limit: 10000 });
      const selected = allMembers.filter((member) => ids.includes(member.id));
      if (selected.length !== ids.length || selected.some((member) => member.bod_approval_status !== "pending")) {
        throw new Error("Only pending membership applications can be approved.");
      }
      const resolutionNumber = nextBodResolutionNumber(allMembers);
      await Promise.all(selected.map((member) => repositories.members.update(member.id, {
        bod_approval_status: "approved",
        acceptance_date: approvalDate,
        acceptance_resolution_number: resolutionNumber,
        membership_status_id: MEMBER_STATUS.active,
      })));
      return resolutionNumber;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["member-options"] });
    },
  });

  return { query, placementEmployees, personNumber, approvalSequence, saveMember, archiveMember, approveMembers };
}
