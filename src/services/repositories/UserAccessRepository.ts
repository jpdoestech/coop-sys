import type { SystemUser, SystemUserInput } from "../../types/systemUser";
import type { AccessRole, Permission } from "../access/accessControl";

export type UserListOptions = {
  search?: string;
  status?: "active" | "inactive" | "all";
  limit?: number;
  offset?: number;
};

export type AccessRoleInput = {
  code: string;
  name: string;
  description: string;
  permissions: Permission[];
  is_active: boolean;
};

export interface UserAccessRepository {
  listPage(
    options?: UserListOptions,
  ): Promise<{ items: SystemUser[]; total: number }>;
  create(input: SystemUserInput): Promise<SystemUser>;
  update(id: string, input: SystemUserInput): Promise<SystemUser>;
  listRoles(): Promise<AccessRole[]>;
  createRole(input: AccessRoleInput): Promise<AccessRole>;
  updateRole(id: string, input: AccessRoleInput): Promise<AccessRole>;
  deleteRole(id: string): Promise<void>;
}
