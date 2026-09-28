import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { createRepositories } from "../../../services/repositories/repositoryFactory";
import type { Member, MemberInput } from "../../../types/member";
import { employeeProfileFromMember } from "../../../services/identity/personProfileSync";

export function useMembers(search: string) {
  const repositories = useMemo(() => createRepositories(), []);
  const queryClient = useQueryClient();
  const queryKey = ["members", search];

  const query = useQuery({
    queryKey,
    queryFn: () => repositories.members.list({ search, limit: 100 })
  });

  const saveMember = useMutation({
    mutationFn: async ({ member, input }: { member: Member | null; input: MemberInput }) => {
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
    mutationFn: (id: string) => repositories.members.archive(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["members"] })
  });

  return { query, saveMember, archiveMember };
}
