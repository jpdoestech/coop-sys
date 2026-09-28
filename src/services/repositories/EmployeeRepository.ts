import type { Employee, EmployeeInput } from "../../types/employee";
import type { CrudRepository } from "./Repository";

export type EmployeeRepository = CrudRepository<Employee, EmployeeInput> & {
  findByEmployeeNumber(employeeNumber: string): Promise<Employee | null>;
  listByMemberId(memberId: string): Promise<Employee[]>;
};
