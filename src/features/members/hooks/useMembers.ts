import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { createRepositories } from "../../../services/repositories/repositoryFactory";
import type { Member, MemberInput } from "../../../types/member";
import { employeeProfileFromMember } from "../../../services/identity/personProfileSync";
import { useAccess } from "../../../services/access/AccessContext";
import { assertPermission, employeeIsInScope, isBranchScoped } from "../../../services/access/accessControl";

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
        : await repositories.members.create(input);
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

  return { query, saveMember, archiveMember };
}
