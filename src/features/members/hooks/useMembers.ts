import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { createRepositories } from "../../../services/repositories/repositoryFactory";
import type { Member, MemberInput } from "../../../types/member";

export function useMembers(search: string) {
  const repositories = useMemo(() => createRepositories(), []);
  const queryClient = useQueryClient();
  const queryKey = ["members", search];

  const query = useQuery({
    queryKey,
    queryFn: () => repositories.members.list({ search, limit: 100 })
  });

  const saveMember = useMutation({
    mutationFn: ({ member, input }: { member: Member | null; input: MemberInput }) =>
      member ? repositories.members.update(member.id, input) : repositories.members.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["members"] })
  });

  const archiveMember = useMutation({
    mutationFn: (id: string) => repositories.members.archive(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["members"] })
  });

  return { query, saveMember, archiveMember };
}
