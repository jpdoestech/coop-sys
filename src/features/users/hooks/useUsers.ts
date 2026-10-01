import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createUserAccessRepository } from "../../../services/repositories/userAccessRepositoryFactory";
import type { SystemUser, SystemUserInput } from "../../../types/systemUser";
import type { UserListOptions } from "../../../services/repositories/UserAccessRepository";

export function useUsers(options: UserListOptions) {
  const repository = useMemo(() => createUserAccessRepository(), []);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["system-users", options],
    queryFn: () => repository.listPage(options),
  });
  const saveUser = useMutation({
    mutationFn: ({
      user,
      input,
    }: {
      user: SystemUser | null;
      input: SystemUserInput;
    }) => (user ? repository.update(user.id, input) : repository.create(input)),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["system-users"] }),
  });
  return { query, saveUser };
}
