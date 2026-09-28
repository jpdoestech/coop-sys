import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createRepositories } from "../../../services/repositories/repositoryFactory";
import type { Employee, EmployeeInput } from "../../../types/employee";
import { governmentIdsFromEmployee, newMemberFromEmployee } from "../../../services/identity/personProfileSync";
import { terminalEmploymentStatuses } from "../../../services/lookups/statuses";
import type { EmployeeSubmission } from "../types/employeeWorkflow";

export function useEmployees(search: string) {
  const repositories = useMemo(() => createRepositories(), []);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["employees", search],
    queryFn: () => repositories.employees.list({ search, limit: 100 })
  });
  const members = useQuery({
    queryKey: ["member-options"],
    queryFn: () => repositories.members.list({ limit: 500 })
  });
  const formerEmployees = useQuery({
    queryKey: ["former-employees"],
    queryFn: async () => {
      const employees = await repositories.employees.list({ limit: 500 });
      return employees.filter((employee) =>
        Boolean(
          employee.employment_status_id &&
          terminalEmploymentStatuses.has(employee.employment_status_id),
        ),
      );
    }
  });
  const saveEmployee = useMutation({
    mutationFn: async ({ employee, submission }: { employee: Employee | null; submission: EmployeeSubmission }) => {
      let input: EmployeeInput = submission.input;
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
    mutationFn: (id: string) => repositories.employees.archive(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["employees"] })
  });
  return { query, members, formerEmployees, saveEmployee, archiveEmployee };
}
