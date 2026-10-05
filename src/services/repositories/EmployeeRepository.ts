import type { Employee, EmployeeInput } from "../../types/employee";
import type { EmploymentAssignmentInput } from "../../types/assignment";
import type { CrudRepository } from "./Repository";

export type EmployeeRepository = CrudRepository<Employee, EmployeeInput> & {
  findByEmployeeNumber(employeeNumber: string): Promise<Employee | null>;
  listByMemberId(memberId: string): Promise<Employee[]>;
  transfer(id: string, assignment: EmploymentAssignmentInput, source?: "employee" | "member" | "system"): Promise<Employee>;
};
