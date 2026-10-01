import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createRepositories } from "../../../services/repositories/repositoryFactory";
import type { Employee, EmployeeInput } from "../../../types/employee";
import { employeeProfileFromMember, governmentIdsFromEmployee, newMemberFromEmployee } from "../../../services/identity/personProfileSync";
import { terminalEmploymentStatuses } from "../../../services/lookups/statuses";
import type { EmployeeSubmission } from "../types/employeeWorkflow";
import { useAccess } from "../../../services/access/useAccess";
import { assertPermission, branchIsInScope, employeeIsInScope } from "../../../services/access/accessControl";
import { nextPersonNumber } from "../../../services/identity/personNumber";
import type { PersonImportRow } from "../../../services/imports/personImport";
import { employeeInputSchema } from "../../../services/validation/employeeSchema";
import { EMPLOYMENT_STATUS } from "../../../services/lookups/statuses";
import { employmentTypes } from "../data/employeeOptions";
import type { ListOptions } from "../../../services/repositories/Repository";
import { createUuid } from "../../../utils/createUuid";

export function useEmployees(options: ListOptions) {
  const repositories = useMemo(() => createRepositories(), []);
  const queryClient = useQueryClient();
  const { profile } = useAccess();
  const query = useQuery({
    queryKey: ["employees", "page", options],
    queryFn: async () => repositories.employees.listPage(options)
  });
  const members = useQuery({
    queryKey: ["member-options"],
    queryFn: async () => {
      const [memberRecords, employeeRecords] = await Promise.all([
        repositories.members.list({ limit: 500 }),
        repositories.employees.list({ limit: 500 }),
      ]);
      const visibleMemberIds = new Set(employeeRecords.filter((employee) => employeeIsInScope(employee, profile)).map((employee) => employee.member_id));
      return profile.branchIds.length ? memberRecords.filter((member) => visibleMemberIds.has(member.id)) : memberRecords;
    }
  });
  const formerEmployees = useQuery({
    queryKey: ["former-employees"],
    queryFn: async () => {
      const employees = await repositories.employees.list({ limit: 500 });
      return employees.filter((employee) => employeeIsInScope(employee, profile) &&
        Boolean(
          employee.employment_status_id &&
          terminalEmploymentStatuses.has(employee.employment_status_id),
        ),
      );
    }
  });
  const personNumber = useQuery({
    queryKey: ["next-person-number"],
    queryFn: async () => nextPersonNumber(
      await repositories.members.list({ limit: 10000 }),
      await repositories.employees.list({ limit: 10000 }),
    ),
  });
  const saveEmployee = useMutation({
    mutationFn: async ({ employee, submission }: { employee: Employee | null; submission: EmployeeSubmission }) => {
      assertPermission(profile, "employees.manage");
      if (employee && !employeeIsInScope(employee, profile)) throw new Error("This employee is outside your assigned branches.");
      let input: EmployeeInput = submission.input;
      if (!employee) input = { ...input, employee_number: personNumber.data ?? input.employee_number };
      if (!branchIsInScope(input.active_assignment?.branch_id, profile)) {
        throw new Error("Select one of your assigned branches for this employee.");
      }
      if (submission.membership.mode === "create") {
        const duplicate = await repositories.members.findByMembershipNumber(
          submission.membership.membershipNumber,
        );
        if (duplicate) throw new Error("Membership number already exists.");
        const member = await repositories.members.create(
          newMemberFromEmployee(input, submission.membership.membershipNumber),
        );
        input = { ...input, member_id: member.id };
      } else if (submission.membership.mode === "existing") {
        const member = await repositories.members.getById(submission.membership.memberId);
        if (!member) throw new Error("Member record not found.");
        const existingLinks = await repositories.employees.listByMemberId(member.id);
        if (existingLinks.some((linked) => linked.id !== employee?.id)) throw new Error("This member ID is already linked to another employee record.");
        input = { ...input, member_id: member.id, employee_number: member.membership_number };
        await repositories.members.update(
          submission.membership.memberId,
          governmentIdsFromEmployee(input),
        );
      } else {
        input = { ...input, member_id: null };
      }
      return employee
        ? repositories.employees.update(employee.id, input)
        : repositories.employees.create(input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["former-employees"] });
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["member-options"] });
      queryClient.invalidateQueries({ queryKey: ["next-person-number"] });
    }
  });
  const archiveEmployee = useMutation({
    mutationFn: async (id: string) => {
      assertPermission(profile, "employees.manage");
      const employee = await repositories.employees.getById(id);
      if (!employee || !employeeIsInScope(employee, profile)) throw new Error("This employee is outside your assigned branches.");
      return repositories.employees.archive(id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["employees"] })
  });
  const importEmployees = useMutation({
    mutationFn: async ({ rows, branchId, clientId }: { rows: PersonImportRow[]; branchId: string; clientId: string }) => {
      assertPermission(profile, "employees.manage");
      if (!branchIsInScope(branchId, profile)) throw new Error("The selected branch is outside your assigned scope.");
      const [memberRecords, employeeRecords] = await Promise.all([repositories.members.list({ limit: 10000 }), repositories.employees.list({ limit: 10000 })]);
      const used = new Set([...memberRecords.map((item) => item.membership_number), ...employeeRecords.map((item) => item.employee_number)]);
      const imported = new Set<string>();
      let sequence = Number(nextPersonNumber(memberRecords, employeeRecords));
      const inputs = rows.map((row) => {
        const explicitlyLinked = row.linkedRecordId ? memberRecords.find((item) => item.id === row.linkedRecordId) : null;
        if (row.linkedRecordId && !explicitlyLinked) throw new Error(`Row ${row.rowNumber}: linked member was not found.`);
        if (explicitlyLinked && row.personNumber && row.personNumber !== explicitlyLinked.membership_number) throw new Error(`Row ${row.rowNumber}: imported ID does not match the linked member ID.`);
        let number = explicitlyLinked?.membership_number ?? row.personNumber;
        const linkedMember = explicitlyLinked ?? (number ? memberRecords.find((item) => item.membership_number === number) : null);
        if (linkedMember && employeeRecords.some((item) => item.member_id === linkedMember.id)) throw new Error(`Row ${row.rowNumber}: linked member already has an employee record.`);
        if (!number) { while (used.has(String(sequence).padStart(6, "0"))) sequence += 1; number = String(sequence++).padStart(6, "0"); }
        if ((employeeRecords.some((item) => item.employee_number === number) && !linkedMember) || imported.has(number)) throw new Error(`Row ${row.rowNumber}: ID ${number} already exists.`); used.add(number); imported.add(number);
        const hired = row.dateHired || new Date().toISOString().slice(0, 10);
        const input: EmployeeInput = { employee_number: number, member_id: linkedMember?.id ?? null, religion_affiliation_id: null, sss_number: null, pagibig_number: null, philhealth_number: null, tax_identification_number: null, first_name: row.firstName, middle_name: row.middleName || null, last_name: row.lastName, suffix: row.suffix || null, date_of_birth: row.birthDate || null, sex: null, civil_status: null, mobile_number: row.mobile || null, email: row.email || null, address: row.address || null, barangay: row.barangay || null, city_municipality: row.city || null, province: row.province || null, postal_code: row.postalCode || null, employment_status_id: EMPLOYMENT_STATUS.active, employment_type_id: employmentTypes[1].id, date_hired: hired, date_regularized: null, date_separated: null, position_id: null, department_id: null, supervisor_id: null, work_location: null, notes: "Imported from Excel", beneficiaries: linkedMember?.beneficiaries ?? [], active_assignment: { id: createUuid(), branch_id: branchId, client_id: clientId || null, assignment_code: null, start_date: hired, end_date: null, work_location: null, transfer_reason: "Initial Excel import", notes: null } };
        return employeeInputSchema.parse(linkedMember ? { ...input, ...employeeProfileFromMember(linkedMember) } : input) as EmployeeInput;
      });
      for (const input of inputs) await repositories.employees.create(input);
      return inputs.length;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["employees"] }); queryClient.invalidateQueries({ queryKey: ["next-person-number"] }); },
  });
  return { query, members, formerEmployees, personNumber, saveEmployee, archiveEmployee, importEmployees };
}
