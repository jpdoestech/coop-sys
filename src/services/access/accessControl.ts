import type { Employee } from "../../types/employee";

export type RoleCode =
  | "super_admin"
  | "general_manager"
  | "hr_manager"
  | "accounting_manager"
  | "head_office_staff"
  | "branch_admin"
  | "branch_user";

export type Permission =
  | "dashboard.view"
  | "members.view"
  | "members.manage"
  | "employees.view"
  | "employees.manage"
  | "payments.view"
  | "payments.manage"
  | "payments.settings.manage"
  | "organization.manage"
  | "documents.view"
  | "documents.manage"
  | "reports.view"
  | "sync.manage"
  | "audit.view"
  | "settings.manage"
  | "users.manage";

export type AccessProfile = {
  userId: string;
  displayName: string;
  role: RoleCode;
  branchIds: string[];
};

export const roleDefinitions: ReadonlyArray<{
  code: RoleCode;
  label: string;
  scope: "organization" | "assigned_branches";
}> = [
  { code: "super_admin", label: "Super Admin", scope: "organization" },
  { code: "general_manager", label: "General Manager", scope: "organization" },
  { code: "hr_manager", label: "HR Manager", scope: "organization" },
  { code: "accounting_manager", label: "Accounting Manager", scope: "organization" },
  { code: "head_office_staff", label: "Head Office Staff", scope: "organization" },
  { code: "branch_admin", label: "Branch Admin", scope: "assigned_branches" },
  { code: "branch_user", label: "Branch User", scope: "assigned_branches" },
];

const permissions: Record<RoleCode, ReadonlySet<Permission>> = {
  super_admin: new Set(["dashboard.view", "members.view", "members.manage", "employees.view", "employees.manage", "payments.view", "payments.manage", "payments.settings.manage", "organization.manage", "documents.view", "documents.manage", "reports.view", "sync.manage", "audit.view", "settings.manage", "users.manage"]),
  general_manager: new Set(["dashboard.view", "members.view", "members.manage", "employees.view", "employees.manage", "payments.view", "payments.manage", "organization.manage", "documents.view", "reports.view", "audit.view"]),
  hr_manager: new Set(["dashboard.view", "members.view", "members.manage", "employees.view", "employees.manage", "organization.manage", "documents.view", "documents.manage", "reports.view", "audit.view"]),
  accounting_manager: new Set(["dashboard.view", "members.view", "employees.view", "payments.view", "payments.manage", "documents.view", "reports.view"]),
  head_office_staff: new Set(["dashboard.view", "members.view", "members.manage", "employees.view", "employees.manage", "payments.view", "payments.manage", "documents.view", "documents.manage", "reports.view"]),
  branch_admin: new Set(["dashboard.view", "members.view", "members.manage", "employees.view", "employees.manage", "payments.view", "payments.manage", "documents.view", "documents.manage", "reports.view"]),
  branch_user: new Set(["dashboard.view", "members.view", "employees.view", "documents.view"]),
};

export function roleLabel(role: RoleCode) {
  return roleDefinitions.find((item) => item.code === role)?.label ?? role;
}

export function hasPermission(profile: AccessProfile, permission: Permission) {
  return permissions[profile.role].has(permission);
}

export function isBranchScoped(profile: AccessProfile) {
  return profile.role === "branch_admin" || profile.role === "branch_user";
}

export function employeeIsInScope(employee: Employee, profile: AccessProfile) {
  if (!isBranchScoped(profile)) return true;
  const branchId = employee.active_assignment?.branch_id;
  return Boolean(branchId && profile.branchIds.includes(branchId));
}

export function branchIsInScope(branchId: string | null | undefined, profile: AccessProfile) {
  return !isBranchScoped(profile) || Boolean(branchId && profile.branchIds.includes(branchId));
}

export function assertPermission(profile: AccessProfile, permission: Permission) {
  if (!hasPermission(profile, permission)) {
    throw new Error("Your role does not permit this action.");
  }
}

