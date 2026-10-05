import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createRepositories } from "../../../services/repositories/repositoryFactory";
import type { Employee, EmployeeInput } from "../../../types/employee";
import { governmentIdsFromEmployee, newMemberFromEmployee } from "../../../services/identity/personProfileSync";
import { terminalEmploymentStatuses } from "../../../services/lookups/statuses";
import type { EmployeeSubmission } from "../types/employeeWorkflow";
import { useAccess } from "../../../services/access/useAccess";
import { assertPermission, branchIsInScope, employeeIsInScope, memberIsInScope } from "../../../services/access/accessControl";
import { nextPersonNumber } from "../../../services/identity/personNumber";
import { importPersonRows, type PersonImportRequest } from "../../../services/imports/personImportWorkflow";
import { useOrganization } from "../../../services/organization/useOrganization";
import type { ListOptions } from "../../../services/repositories/Repository";

export function useEmployees(options: ListOptions) {
  const repositories = useMemo(() => createRepositories(), []);
  const queryClient = useQueryClient();
  const { profile } = useAccess();
  const directory = useOrganization();
  const query = useQuery({
    queryKey: ["employees", "page", options],
    refetchInterval: 30000,
    queryFn: async () => repositories.employees.listPage(options)
  });
  const members = useQuery({
    queryKey: ["member-options", profile.userId, profile.scopeType, profile.branchIds, profile.clientIds],
    queryFn: async () => {
      const [memberRecords, employeeRecords] = await Promise.all([
        repositories.members.list({ limit: 500 }),
        repositories.employees.list({ limit: 500 }),
      ]);
      return memberRecords.filter((member) => memberIsInScope(member, profile, employeeRecords));
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
      await repositories.members.list({ includeDeleted: true, limit: 10000 }),
      await repositories.employees.list({ includeDeleted: true, limit: 10000 }),
    ),
  });
  const saveEmployee = useMutation({
    mutationFn: async ({ employee, submission }: { employee: Employee | null; submission: EmployeeSubmission }) => {
      assertPermission(profile, employee ? "employees.update" : "employees.create");
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
      queryClient.invalidateQueries({ queryKey: ["member-placement-employees"] });
      queryClient.invalidateQueries({ queryKey: ["member-linked-employee"] });
      queryClient.invalidateQueries({ queryKey: ["payment-employees"] });
      queryClient.invalidateQueries({ queryKey: ["payment-ledger"] });
    }
  });
  const archiveEmployee = useMutation({
    mutationFn: async (id: string) => {
      assertPermission(profile, "employees.delete");
      const employee = await repositories.employees.getById(id);
      if (!employee || !employeeIsInScope(employee, profile)) throw new Error("This employee is outside your assigned branches.");
      return repositories.employees.archive(id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["employees"] })
  });
  const importEmployees = useMutation({
    mutationFn: (request: PersonImportRequest) => importPersonRows("employee", repositories, profile, directory, request),
    onSuccess: () => { for (const key of ["employees", "members", "member-options", "next-person-number", "member-placement-employees", "member-linked-employee", "payment-employees"]) queryClient.invalidateQueries({ queryKey: [key] }); },
  });
  return { query, members, formerEmployees, personNumber, saveEmployee, archiveEmployee, importEmployees };
}
