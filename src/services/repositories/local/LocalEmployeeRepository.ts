import { developmentEmployees } from "../../../database/seeds/employeeSeed";
import type { Employee, EmployeeInput } from "../../../types/employee";
import type { EmployeeRepository } from "../EmployeeRepository";
import type { ListOptions } from "../Repository";

const STORAGE_KEY = "coop_sys_employees";

function now() {
  return new Date().toISOString();
}

function writeEmployees(employees: Employee[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(employees));
}

function readEmployees(): Employee[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) return JSON.parse(raw) as Employee[];
  if (import.meta.env.DEV) {
    writeEmployees(developmentEmployees);
    return developmentEmployees;
  }
  return [];
}

export class LocalEmployeeRepository implements EmployeeRepository {
  async list(options: ListOptions = {}) {
    let employees = readEmployees();
    if (!options.includeDeleted) employees = employees.filter((employee) => !employee.deleted_at);
    if (options.search) {
      const search = options.search.toLowerCase();
      employees = employees.filter((employee) =>
        [employee.employee_number, employee.first_name, employee.last_name, employee.work_location]
          .join(" ")
          .toLowerCase()
          .includes(search)
      );
    }
    return employees
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .slice(options.offset ?? 0, options.limit ? (options.offset ?? 0) + options.limit : undefined);
  }

  async getById(id: string) {
    return readEmployees().find((employee) => employee.id === id) ?? null;
  }

  async findByEmployeeNumber(employeeNumber: string) {
    return readEmployees().find((employee) => employee.employee_number === employeeNumber) ?? null;
  }

  async create(input: EmployeeInput) {
    const timestamp = now();
    const employee: Employee = {
      ...input,
      beneficiaries: input.beneficiaries.map((beneficiary) => ({ ...beneficiary, deactivated_at: beneficiary.is_active ? null : timestamp })),
      id: crypto.randomUUID(),
      created_at: timestamp,
      updated_at: timestamp,
      deleted_at: null,
      sync_status: "pending_create"
    };
    writeEmployees([...readEmployees(), employee]);
    return employee;
  }

  async update(id: string, input: Partial<EmployeeInput>) {
    const employees = readEmployees();
    const index = employees.findIndex((employee) => employee.id === id);
    if (index === -1) throw new Error("Employee not found.");
    const timestamp = now();
    const employee: Employee = {
      ...employees[index],
      ...input,
      beneficiaries: (input.beneficiaries ?? employees[index].beneficiaries).map((beneficiary) => {
        const existing = employees[index].beneficiaries.find((item) => item.id === beneficiary.id);
        return {
          ...beneficiary,
          deactivated_at: beneficiary.is_active ? null : existing?.deactivated_at ?? timestamp
        };
      }),
      updated_at: timestamp,
      sync_status: employees[index].sync_status === "pending_create" ? "pending_create" : "pending_update"
    };
    employees[index] = employee;
    writeEmployees(employees);
    return employee;
  }

  async archive(id: string) {
    const employees = readEmployees();
    const index = employees.findIndex((employee) => employee.id === id);
    if (index === -1) throw new Error("Employee not found.");
    employees[index] = { ...employees[index], deleted_at: now(), updated_at: now(), sync_status: "pending_delete" };
    writeEmployees(employees);
  }

  async restore(id: string) {
    const employees = readEmployees();
    const index = employees.findIndex((employee) => employee.id === id);
    if (index === -1) throw new Error("Employee not found.");
    employees[index] = { ...employees[index], deleted_at: null, updated_at: now(), sync_status: "pending_update" };
    writeEmployees(employees);
    return employees[index];
  }
}
