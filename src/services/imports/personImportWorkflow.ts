import type { RepositorySet } from "../repositories/repositoryFactory";
import type { AccessProfile } from "../access/accessControl";
import { assertPermission, employeeIsInScope } from "../access/accessControl";
import { placementOptions } from "../access/placementOptions";
import type { OrganizationDirectory } from "../../types/organization";
import type { PersonImportOutcome, PersonImportRow } from "./personImport";
import type { Employee, EmployeeInput } from "../../types/employee";
import type { Member, MemberInput } from "../../types/member";
import { nextPersonNumber } from "../identity/personNumber";
import { employeeProfileFromMember } from "../identity/personProfileSync";
import { employeeInputSchema } from "../validation/employeeSchema";
import { memberInputSchema } from "../validation/memberSchema";
import { createUuid } from "../../utils/createUuid";

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
        const validated = employeeInputSchema.parse(linkedMember ? { ...input, ...employeeProfileFromMember(linkedMember) } : input) as EmployeeInput;
        stage = "save";
        const saved = await repositories.employees.create(validated);
        employees.push(saved); used.add(number);
        outcomes.push({ rowNumber: row.rowNumber, status: "imported", message: `Imported ${number}`, recordId: saved.id });
      } else {
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
        if (linkedEmployee) {
          await repositories.employees.update(linkedEmployee.id, { ...employeeProfileFromMember(saved), ...(!linkedEmployee.active_assignment ? { active_assignment: assignment, work_location: assignment.work_location } : {}) });
          linkedEmployee.member_id = saved.id;
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
