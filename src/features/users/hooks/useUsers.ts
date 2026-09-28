import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LocalUserAccessRepository } from "../../../services/repositories/local/LocalUserAccessRepository";
import type { SystemUser, SystemUserInput } from "../../../types/systemUser";

export function useUsers() {
  const repository = useMemo(() => new LocalUserAccessRepository(), []);
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["system-users"], queryFn: () => repository.list() });
  const saveUser = useMutation({
    mutationFn: ({ user, input }: { user: SystemUser | null; input: SystemUserInput }) =>
      user ? repository.update(user.id, input) : repository.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["system-users"] }),
  });
  return { query, saveUser };
}

