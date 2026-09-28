import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createRepositories } from "../../../services/repositories/repositoryFactory";
import type { Employee, EmployeeInput } from "../../../types/employee";
import { governmentIdsFromEmployee, newMemberFromEmployee } from "../../../services/identity/personProfileSync";
import { terminalEmploymentStatuses } from "../../../services/lookups/statuses";
import type { EmployeeSubmission } from "../types/employeeWorkflow";
import { useAccess } from "../../../services/access/AccessContext";
import { assertPermission, branchIsInScope, employeeIsInScope } from "../../../services/access/accessControl";

export function useEmployees(search: string) {
  const repositories = useMemo(() => createRepositories(), []);
  const queryClient = useQueryClient();
  const { profile } = useAccess();
  const query = useQuery({
    queryKey: ["employees", search],
    queryFn: async () => (await repositories.employees.list({ search, limit: 100 })).filter((employee) => employeeIsInScope(employee, profile))
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
  const saveEmployee = useMutation({
    mutationFn: async ({ employee, submission }: { employee: Employee | null; submission: EmployeeSubmission }) => {
      assertPermission(profile, "employees.manage");
      if (employee && !employeeIsInScope(employee, profile)) throw new Error("This employee is outside your assigned branches.");
      let input: EmployeeInput = submission.input;
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
        input = { ...input, member_id: submission.membership.memberId };
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
  return { query, members, formerEmployees, saveEmployee, archiveEmployee };
}
