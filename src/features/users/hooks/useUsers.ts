import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createUserAccessRepository } from "../../../services/repositories/userAccessRepositoryFactory";
import type { SystemUser, SystemUserInput } from "../../../types/systemUser";
import type { AccessRoleInput, UserListOptions } from "../../../services/repositories/UserAccessRepository";
import type { AccessRole } from "../../../services/access/accessControl";

export function useUsers(options: UserListOptions) {
  const repository = useMemo(() => createUserAccessRepository(), []);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["system-users", options],
    queryFn: () => repository.listPage(options),
  });
  const roles = useQuery({ queryKey: ["access-roles"], queryFn: () => repository.listRoles() });
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
  const saveRole = useMutation({
    mutationFn: ({ role, input }: { role: AccessRole | null; input: AccessRoleInput }) => role ? repository.updateRole(role.id, input) : repository.createRole(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["access-roles"] }),
  });
  const deleteRole = useMutation({
    mutationFn: (id: string) => repository.deleteRole(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["access-roles"] }),
  });
  return { query, roles, saveUser, saveRole, deleteRole };
}
