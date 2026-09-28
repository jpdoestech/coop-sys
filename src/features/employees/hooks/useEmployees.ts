import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createRepositories } from "../../../services/repositories/repositoryFactory";
import type { Employee, EmployeeInput } from "../../../types/employee";

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
  const saveEmployee = useMutation({
    mutationFn: ({ employee, input }: { employee: Employee | null; input: EmployeeInput }) =>
      employee ? repositories.employees.update(employee.id, input) : repositories.employees.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["employees"] })
  });
  const archiveEmployee = useMutation({
    mutationFn: (id: string) => repositories.employees.archive(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["employees"] })
  });
  return { query, members, saveEmployee, archiveEmployee };
}
