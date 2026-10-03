import type { AccessScopeType, Permission, RoleCode } from "../services/access/accessControl";

export type SystemUser = {
  id: string;
  display_name: string;
  email: string;
  role: RoleCode;
  role_ids: string[];
  branch_ids: string[];
  client_ids: string[];
  direct_grants: Permission[];
  direct_denies: Permission[];
  scope_type: AccessScopeType;
  resource_assignments: string[];
  linked_employee_id: string | null;
  manager_user_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type SystemUserInput = Omit<SystemUser, "id" | "created_at" | "updated_at"> & {
  temporary_password?: string;
};

