import { assertPermission, isBranchScoped, type AccessProfile } from "../access/accessControl";
export function assertPayrollAccess(profile: AccessProfile, manage = false) {
  assertPermission(profile, manage ? "payroll.manage" : "payroll.view");
  if (isBranchScoped(profile)) throw new Error("Payroll setup currently requires organization-wide scope.");
}
