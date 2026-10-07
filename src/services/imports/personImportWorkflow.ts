import type { RepositorySet } from "../repositories/repositoryFactory";
import type { AccessProfile } from "../access/accessControl";
import { assertPermission, employeeIsInScope } from "../access/accessControl";
import { placementOptions } from "../access/placementOptions";
import type { OrganizationDirectory } from "../../types/organization";
import type { PersonImportOutcome, PersonImportRow } from "./personImport";
import type { Employee, EmployeeInput } from "../../types/employee";
import type { Member, MemberInput } from "../../types/member";
import { nextPersonNumber } from "../identity/personNumber";
import { employeeProfileFromMember, newMemberFromEmployee } from "../identity/personProfileSync";
import { ensureMemberEmployee } from "../identity/personRegistration";
import { employeeInputSchema } from "../validation/employeeSchema";
import { memberInputSchema } from "../validation/memberSchema";
import { createUuid } from "../../utils/createUuid";
import { normalizeIdentityName } from "./identityMatching";

export type PersonImportRequest = { rows: PersonImportRow[]; branchId: string; clientId: string };

export function assertImportPlacement(profile: AccessProfile, directory: Pick<OrganizationDirectory, "branches" | "clients">, branchId: string, clientId: string) {
  const scoped = placementOptions(profile, directory.branches.filter((item) => item.isActive), directory.clients.filter((item) => item.isActive));
  const branch = scoped.branches.find((item) => item.id === branchId);
  if (!branch) throw new Error("Select an active branch within your assigned scope.");
  if (clientId && (!scoped.clients.some((item) => item.id === clientId && item.branchId === branchId) || branch.type === "head_office")) throw new Error("Select a client within the selected branch and your assigned scope.");
  if (profile.scopeType === "assigned_clients" && !clientId) throw new Error("Select one of your assigned clients.");
  return branch;
}

async function allRecords<T>(repository: { listPage: (options: { includeDeleted: boolean; limit: number; offset: number }) => Promise<{ items: T[]; total: number }> }) {
  const records: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const page = await repository.listPage({ includeDeleted: true, limit: 500, offset });
    records.push(...page.items);
    if (!page.items.length || records.length >= page.total) return records;
  }
}

export async function importPersonRows(kind: "member" | "employee", repositories: RepositorySet, profile: AccessProfile, directory: OrganizationDirectory, request: PersonImportRequest): Promise<PersonImportOutcome[]> {
  assertPermission(profile, `${kind === "employee" ? "employees" : "members"}.import`);
  const branch = assertImportPlacement(profile, directory, request.branchId, request.clientId);
  const [members, employees] = await Promise.all([allRecords<Member>(repositories.members), allRecords<Employee>(repositories.employees)]);
  const used = new Set([...members.map((item) => item.membership_number), ...employees.map((item) => item.employee_number)]);
  let sequence = Number(nextPersonNumber(members, employees));
  const outcomes: PersonImportOutcome[] = [];
  for (const [index, row] of request.rows.entries()) {
    // Let pending-state rendering and navigation guards run during large local batches.
    if (index % 25 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
    if (row.errors.length) { outcomes.push({ rowNumber: row.rowNumber, status: "error", message: row.errors.join(" "), errorType: row.errorTypes[0] || "validation" }); continue; }
    let stage: "validation" | "save" = "validation";
    let savedRecordId: string | undefined;
    try {
      let number = row.personNumber;
      const linkedMember = kind === "employee" ? members.find((item) => row.linkedRecordId ? item.id === row.linkedRecordId : Boolean(number) && item.membership_number === number) : undefined;
      const linkedEmployee = kind === "member" ? employees.find((item) => row.linkedRecordId ? item.id === row.linkedRecordId : Boolean(number) && item.employee_number === number) : undefined;
      if (row.linkedRecordId && !linkedMember && !linkedEmployee) throw new Error("The linked record was not found within your scope.");
      const linkedNumber = linkedMember?.membership_number || linkedEmployee?.employee_number;
      if (number && linkedNumber && number !== linkedNumber) throw new Error("Imported ID does not match the linked record ID.");
      number = linkedNumber || number;
      if (!number) { while (used.has(String(sequence).padStart(6, "0"))) sequence += 1; number = String(sequence++).padStart(6, "0"); }
      if (number.length > 6) throw new Error("The six-digit ID sequence is exhausted.");
      if (kind === "employee" && employees.some((item) => item.employee_number === number || linkedMember && item.member_id === linkedMember.id)) throw new Error("ID already exists as an employee. Use the employee edit/transfer workflow.");
      if (kind === "member" && (members.some((item) => item.membership_number === number) || linkedEmployee?.member_id)) throw new Error("ID already exists as a member.");
      if (linkedEmployee && !employeeIsInScope(linkedEmployee, profile)) throw new Error("The linked employee is outside your scope.");
      const fields = kind === "employee" ? row.employeeFields : row.memberFields;
      const fullName = normalizeIdentityName([fields.first_name, fields.middle_name, fields.last_name, fields.suffix].filter(Boolean).join(" "));
      const otherPeople = [...members, ...employees].filter((item) => item.id !== linkedMember?.id && item.id !== linkedEmployee?.id);
      for (const person of otherPeople) {
        if (fullName && normalizeIdentityName([person.first_name, person.middle_name, person.last_name, person.suffix].filter(Boolean).join(" ")) === fullName) throw new Error("Full name already exists. Link the existing person instead of creating a duplicate.");
        if (fields.email && person.email?.trim().toLowerCase() === fields.email.trim().toLowerCase()) throw new Error("Email address already exists on another person.");
        for (const key of ["sss_number", "pagibig_number", "philhealth_number", "tax_identification_number"] as const) {
          if (fields[key] && person[key] && fields[key]?.replace(/\D/g, "") === person[key]?.replace(/\D/g, "")) throw new Error(`${key.replaceAll("_", " ").toUpperCase()} already exists on another person.`);
        }
      }
      if ([fields.sss_number, fields.pagibig_number, fields.philhealth_number, fields.tax_identification_number].some(Boolean)) assertPermission(profile, `${kind === "employee" ? "employees" : "members"}.sensitive.update`);
      const assignment = { id: createUuid(), branch_id: branch.id, client_id: request.clientId || null, assignment_code: null, start_date: row.dateHired || new Date().toISOString().slice(0, 10), end_date: null, work_location: branch.label, transfer_reason: "Initial Excel import", notes: null, ...row.assignmentFields };
      if (!assignment.work_location) assignment.work_location = branch.label;
      if (kind === "employee") {
        let input: Partial<EmployeeInput> = { ...row.employeeFields, employee_number: number, member_id: linkedMember?.id || null, date_hired: row.dateHired || new Date().toISOString().slice(0, 10), supervisor_id: null, active_assignment: assignment };
        if (row.employeeFields.supervisor_id) {
          const supervisor = employees.find((item) => !item.deleted_at && (item.id === row.employeeFields.supervisor_id || item.employee_number === row.employeeFields.supervisor_id?.padStart(6, "0")) && employeeIsInScope(item, profile));
          if (!supervisor) throw new Error("Supervisor ID was not found within your scope.");
          input = { ...input, supervisor_id: supervisor.id };
        }
        let validated = employeeInputSchema.parse(linkedMember ? { ...input, ...employeeProfileFromMember(linkedMember), ...((row.source?.DEPARTMENT || row.source?.POSITION) ? { department_id: input.department_id, position_id: input.position_id, pending_department_name: input.pending_department_name, pending_position_name: input.pending_position_name } : {}), import_attention: input.import_attention } : input) as EmployeeInput;
        if (linkedMember?.bod_approval_status === "pending" && !linkedMember.termination_date) validated.employment_status_id = input.employment_status_id || validated.employment_status_id;
        if (!linkedMember) {
          assertPermission(profile, "members.create");
          if ([validated.sss_number, validated.pagibig_number, validated.philhealth_number, validated.tax_identification_number].some(Boolean)) assertPermission(profile, "members.sensitive.update");
          const membership = memberInputSchema.parse({ ...newMemberFromEmployee(validated, number), ...row.memberFields,
            membership_number: number, proposed_branch_id: branch.id, proposed_client_id: request.clientId || null,
            membership_date: row.membershipDate || new Date().toISOString().slice(0, 10),
            bod_approval_status: "pending", acceptance_date: null, acceptance_resolution_number: null,
          }) as MemberInput;
          stage = "save";
          const member = await repositories.members.create(membership);
          savedRecordId = member.id;
          members.push(member);
          validated = { ...validated, member_id: member.id };
        }
        stage = "save";
        const saved = await repositories.employees.create(validated);
        employees.push(saved); used.add(number);
        outcomes.push({ rowNumber: row.rowNumber, status: "imported", message: `Imported ${number}`, recordId: saved.id });
      } else {
        if (!linkedEmployee) assertPermission(profile, "employees.create");
        if ([fields.sss_number, fields.pagibig_number, fields.philhealth_number, fields.tax_identification_number].some(Boolean)) assertPermission(profile, "employees.sensitive.update");
        if (row.memberFields.bod_approval_status === "approved") assertPermission(profile, "members.approve");
        if (linkedEmployee) {
          assertPermission(profile, "employees.update");
          if (linkedEmployee.active_assignment && (linkedEmployee.active_assignment.branch_id !== branch.id || linkedEmployee.active_assignment.client_id !== (request.clientId || null))) throw new Error("The linked employee has a different deployment. Record a transfer before importing membership.");
        }
        const input = memberInputSchema.parse({ ...row.memberFields, membership_number: number, membership_date: row.membershipDate || new Date().toISOString().slice(0, 10), proposed_branch_id: branch.id, proposed_client_id: request.clientId || null }) as MemberInput;
        stage = "save";
        const saved = await repositories.members.create(input);
        savedRecordId = saved.id;
        members.push(saved); used.add(number);
        const employee = await ensureMemberEmployee(repositories, profile, saved, { ...row.employeeFields, active_assignment: assignment, work_location: assignment.work_location });
        if (employee) {
          const index = employees.findIndex((item) => item.id === employee.id);
          if (index < 0) employees.push(employee); else employees[index] = employee;
        }
        outcomes.push({ rowNumber: row.rowNumber, status: "imported", message: `Imported ${number}`, recordId: saved.id });
      }
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String((reason as { message?: string })?.message || "Record could not be saved.");
      outcomes.push({ rowNumber: row.rowNumber, status: "error", message: savedRecordId ? `Member created, but employee linking failed: ${message}. Complete the link from the employee entry; do not re-import this row.` : message, recordId: savedRecordId, errorType: /already exists/.test(message) ? "duplicate" : /scope|permit|assigned/.test(message) ? "scope" : stage });
    }
  }
  return outcomes;
}
