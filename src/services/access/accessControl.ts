import type { Employee } from "../../types/employee";

export type RoleCode = string;
export type Permission = string;
export type AccessScopeType = "organization" | "assigned_branches" | "assigned_clients" | "self";
export type PermissionAction = "view" | "create" | "update" | "delete" | "import" | "export" | "approve" | "manage";
export type PermissionModule = { id: string; label: string; actions: ReadonlyArray<{ action: PermissionAction; permission: Permission; label: string }> };

const moduleDefinition = (id: string, label: string, actions: PermissionAction[]): PermissionModule => ({
  id,
  label,
  actions: actions.map((action) => ({ action, permission: `${id}.${action}`, label: action[0].toUpperCase() + action.slice(1) })),
});

export const permissionModules: ReadonlyArray<PermissionModule> = [
  moduleDefinition("dashboard", "Dashboard", ["view"]),
  moduleDefinition("members", "Members", ["view", "create", "update", "delete", "import", "export", "approve", "manage"]),
  moduleDefinition("members.sensitive", "Member government IDs", ["view", "update"]),
  moduleDefinition("employees", "Employees", ["view", "create", "update", "delete", "import", "export", "approve", "manage"]),
  moduleDefinition("employees.sensitive", "Employee government IDs", ["view", "update"]),
  moduleDefinition("payments", "Payments", ["view", "create", "update", "delete", "import", "export", "approve", "manage"]),
  moduleDefinition("payments.settings", "Payment settings", ["view", "manage"]),
  moduleDefinition("organization", "Organization", ["view", "create", "update", "delete", "manage"]),
  moduleDefinition("documents", "Documents", ["view", "create", "update", "delete", "export", "manage"]),
  moduleDefinition("reports", "Reports", ["view", "export"]),
  moduleDefinition("sync", "Synchronization", ["view", "manage"]),
  moduleDefinition("audit", "Audit logs", ["view", "export"]),
  moduleDefinition("settings", "System settings", ["view", "manage"]),
  moduleDefinition("users", "Users", ["view", "create", "update", "delete", "manage"]),
  moduleDefinition("roles", "Roles and permissions", ["view", "create", "update", "delete", "manage"]),
];

export const allPermissions = permissionModules.flatMap((module) => module.actions.map((item) => item.permission));

export type AccessProfile = {
  userId: string; displayName: string; role: RoleCode; roleIds?: string[]; roleLabels?: string[];
  branchIds: string[]; clientIds?: string[]; scopeType?: AccessScopeType;
  linkedEmployeeId?: string | null; managerUserId?: string | null;
  effectivePermissions?: Permission[]; directGrants?: Permission[]; directDenies?: Permission[];
};

export type AccessRole = {
  id: string; code: RoleCode; name: string; description: string; permissions: Permission[];
  is_active: boolean; is_system: boolean; created_at: string; updated_at: string;
};

export const roleDefinitions: ReadonlyArray<{ code: RoleCode; label: string; scope: "organization" | "assigned_branches" }> = [
  { code: "super_admin", label: "Super Admin", scope: "organization" },
  { code: "general_manager", label: "General Manager", scope: "organization" },
  { code: "hr_manager", label: "HR Manager", scope: "organization" },
  { code: "accounting_manager", label: "Accounting Manager", scope: "organization" },
  { code: "head_office_staff", label: "Head Office Staff", scope: "organization" },
  { code: "branch_admin", label: "Branch Admin", scope: "assigned_branches" },
  { code: "branch_user", label: "Branch User", scope: "assigned_branches" },
];

const modulePermissions = (ids: string[]) => permissionModules.filter((module) => ids.includes(module.id)).flatMap((module) => module.actions.map((action) => action.permission));

export const defaultRolePermissions: Record<string, Permission[]> = {
  super_admin: allPermissions,
  general_manager: modulePermissions(["dashboard", "members", "employees", "payments", "organization", "documents", "reports", "audit"]),
  hr_manager: modulePermissions(["dashboard", "members", "employees", "organization", "documents", "reports", "audit"]),
  accounting_manager: [...modulePermissions(["dashboard", "reports"]), "members.view", "employees.view", "payments.view", "payments.create", "payments.update", "payments.import", "payments.export", "payments.manage", "documents.view"],
  head_office_staff: modulePermissions(["dashboard", "members", "employees", "payments", "documents", "reports"]),
  branch_admin: modulePermissions(["dashboard", "members", "employees", "payments", "documents", "reports"]),
  branch_user: ["dashboard.view", "members.view", "employees.view", "payments.view", "documents.view"],
};

export function createDefaultRoles(timestamp = new Date().toISOString()): AccessRole[] {
  return roleDefinitions.map((role, index) => ({
    id: `70000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    code: role.code, name: role.label, description: `${role.label} default access policy.`,
    permissions: [...(defaultRolePermissions[role.code] ?? [])], is_active: true,
    is_system: role.code === "super_admin", created_at: timestamp, updated_at: timestamp,
  }));
}

export function roleLabel(role: RoleCode) { return roleDefinitions.find((item) => item.code === role)?.label ?? role; }

export function effectivePermissionSet(rolePermissions: Permission[], directGrants: Permission[] = [], directDenies: Permission[] = []) {
  const denied = new Set(directDenies);
  return new Set([...rolePermissions, ...directGrants].filter((item) => !denied.has(item)));
}

export function hasPermission(profile: AccessProfile, permission: Permission) {
  if (profile.role === "super_admin") return true;
  const permissions = profile.effectivePermissions ?? defaultRolePermissions[profile.role] ?? [];
  return permissions.includes(permission) && !(profile.directDenies ?? []).includes(permission);
}

export function isBranchScoped(profile: AccessProfile) {
  return (profile.scopeType ?? (profile.branchIds.length ? "assigned_branches" : "organization")) !== "organization";
}

export function employeeIsInScope(employee: Employee, profile: AccessProfile) {
  if (profile.scopeType === "self") return Boolean(profile.linkedEmployeeId && employee.id === profile.linkedEmployeeId);
  if (!isBranchScoped(profile)) return true;
  const assignment = employee.active_assignment;
  if (!assignment) return false;
  if (profile.scopeType === "assigned_clients") return Boolean(assignment.client_id && profile.clientIds?.includes(assignment.client_id));
  return Boolean(assignment.branch_id && profile.branchIds.includes(assignment.branch_id));
}

export function branchIsInScope(branchId: string | null | undefined, profile: AccessProfile) {
  return !isBranchScoped(profile) || Boolean(branchId && profile.branchIds.includes(branchId));
}

export function assertPermission(profile: AccessProfile, permission: Permission) {
  if (!hasPermission(profile, permission)) throw new Error("Your effective access does not permit this action.");
}
