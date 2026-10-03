import type { SystemUser } from "../../types/systemUser";
import {
  createDefaultRoles,
  effectivePermissionSet,
  type AccessProfile,
  type AccessRole,
  type AccessScopeType,
} from "./accessControl";

export const ACCESS_ROLES_STORAGE_KEY = "coop_sys_access_roles";

export function defaultRoleId(code: string) {
  return createDefaultRoles().find((role) => role.code === code)?.id ?? code;
}

export function normalizeRole(role: Partial<AccessRole> & Pick<AccessRole, "id" | "code" | "name">): AccessRole {
  const timestamp = new Date().toISOString();
  return {
    description: "",
    permissions: [],
    is_active: true,
    is_system: false,
    created_at: timestamp,
    updated_at: timestamp,
    ...role,
  };
}

export function normalizeSystemUser(user: Partial<SystemUser> & Pick<SystemUser, "id" | "display_name" | "email" | "role">): SystemUser {
  const timestamp = new Date().toISOString();
  const branchIds = user.branch_ids ?? [];
  const inferredScope: AccessScopeType = branchIds.length ? "assigned_branches" : "organization";
  return {
    role_ids: user.role_ids?.length ? user.role_ids : [defaultRoleId(user.role)],
    client_ids: [],
    direct_grants: [],
    direct_denies: [],
    scope_type: inferredScope,
    resource_assignments: [],
    linked_employee_id: null,
    manager_user_id: null,
    is_active: true,
    created_at: timestamp,
    updated_at: timestamp,
    ...user,
    branch_ids: branchIds,
  };
}

export function rolesForUser(user: SystemUser, roles: AccessRole[]) {
  const ids = new Set(user.role_ids ?? []);
  const assigned = roles.filter((role) => ids.has(role.id) && role.is_active);
  if (assigned.length) return assigned;
  return roles.filter((role) => role.code === user.role && role.is_active);
}

export function accessProfileForUser(userValue: SystemUser, roles: AccessRole[]): AccessProfile {
  const user = normalizeSystemUser(userValue);
  const assignedRoles = rolesForUser(user, roles);
  const rolePermissions = assignedRoles.flatMap((role) => role.permissions);
  const effectivePermissions = [...effectivePermissionSet(rolePermissions, user.direct_grants, user.direct_denies)];
  const primaryRole = assignedRoles[0]?.code ?? user.role;
  return {
    userId: user.id,
    displayName: user.display_name,
    role: primaryRole,
    roleIds: assignedRoles.map((role) => role.id),
    roleLabels: assignedRoles.map((role) => role.name),
    branchIds: user.branch_ids,
    clientIds: user.client_ids,
    scopeType: user.scope_type,
    linkedEmployeeId: user.linked_employee_id,
    managerUserId: user.manager_user_id,
    directGrants: user.direct_grants,
    directDenies: user.direct_denies,
    effectivePermissions,
  };
}

