import type { Member } from "../../types/member";
import type { EmployeeInput } from "../../types/employee";
import type { AccessProfile } from "../access/accessControl";
import { assertPermission, employeeIsInScope } from "../access/accessControl";
import type { RepositorySet } from "../repositories/repositoryFactory";
import { employeeProfileFromMember } from "./personProfileSync";
import { employeeInputSchema } from "../validation/employeeSchema";
import { EMPLOYMENT_STATUS } from "../lookups/statuses";
import { createUuid } from "../../utils/createUuid";

export async function ensureMemberEmployee(repositories: RepositorySet, profile: AccessProfile, member: Member, employment: Partial<EmployeeInput> = {}) {
  if (!member.proposed_branch_id) return null;
  if ([member.sss_number, member.pagibig_number, member.philhealth_number, member.tax_identification_number].some(Boolean)) assertPermission(profile, "employees.sensitive.update");
  const linked = await repositories.employees.listByMemberId(member.id);
  const existing = linked.find((employee) => !employee.deleted_at)
    || await repositories.employees.findByEmployeeNumber(member.membership_number);
  if (existing) {
    if (existing.deleted_at || existing.member_id && existing.member_id !== member.id) throw new Error("The shared ID belongs to another or archived employee. Use the re-employment workflow.");
    if (!employeeIsInScope(existing, profile)) throw new Error("The linked employee is outside your scope.");
    const placement = existing.active_assignment;
    if (placement && (placement.branch_id !== member.proposed_branch_id || placement.client_id !== member.proposed_client_id)) throw new Error("The employee has another deployment. Record a transfer instead of overwriting its placement.");
    if (existing.member_id === member.id && placement) return existing;
    assertPermission(profile, "employees.update");
    if (!placement && existing.assignment_history.length) throw new Error("The employee's assignment has ended. Use the re-employment workflow.");
    return repositories.employees.update(existing.id, {
      ...employeeProfileFromMember(member),
      ...(member.bod_approval_status === "pending" && !member.termination_date ? { employment_status_id: employment.employment_status_id || existing.employment_status_id } : {}),
      ...(!placement ? { active_assignment: employment.active_assignment || {
        id: createUuid(), branch_id: member.proposed_branch_id, client_id: member.proposed_client_id,
        start_date: existing.date_hired || new Date().toISOString().slice(0, 10), end_date: null,
        assignment_code: null, work_location: existing.work_location, transfer_reason: "Initial deployment from member record", notes: null,
      } } : {}),
    });
  }
  assertPermission(profile, "employees.create");
  const input = employeeInputSchema.parse({
    employment_type_id: "32000000-0000-4000-8000-000000000002", date_hired: null,
    date_regularized: null, date_separated: null, department_id: null, position_id: null,
    supervisor_id: null, work_location: null, notes: null,
    ...employment, ...employeeProfileFromMember(member),
    import_attention: member.import_attention || employment.import_attention || null,
    employment_status_id: member.bod_approval_status === "pending" && !member.termination_date
      ? employment.employment_status_id || EMPLOYMENT_STATUS.active : employeeProfileFromMember(member).employment_status_id,
    active_assignment: employment.active_assignment || {
      id: createUuid(), branch_id: member.proposed_branch_id, client_id: member.proposed_client_id,
      start_date: employment.date_hired || new Date().toISOString().slice(0, 10), end_date: null,
      assignment_code: null, work_location: employment.work_location || null,
      transfer_reason: "Initial deployment from member record", notes: null,
    },
  }) as EmployeeInput;
  return repositories.employees.create(input);
}
