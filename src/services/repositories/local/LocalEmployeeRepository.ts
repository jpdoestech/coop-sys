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

function normalizeEmployee(employee: Employee): Employee {
  const history = (employee.assignment_history ?? (employee.active_assignment ? [employee.active_assignment] : []))
    .map((assignment) => ({ ...assignment, transfer_reason: assignment.transfer_reason ?? null }))
    .sort((a, b) => b.start_date.localeCompare(a.start_date));
  return {
    ...employee,
    assignment_history: history,
    active_assignment: history.find((assignment) => !assignment.end_date) ?? null,
  };
}

function readEmployees(): Employee[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) return (JSON.parse(raw) as Employee[]).map(normalizeEmployee);
  if (import.meta.env.DEV) {
    writeEmployees(developmentEmployees);
    return developmentEmployees.map(normalizeEmployee);
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

  async listByMemberId(memberId: string) {
    return readEmployees().filter((employee) => employee.member_id === memberId);
  }

  async create(input: EmployeeInput) {
    const timestamp = now();
    const employee: Employee = {
      ...input,
      beneficiaries: input.beneficiaries.map((beneficiary) => ({ ...beneficiary, deactivated_at: beneficiary.is_active ? null : timestamp })),
      active_assignment: input.active_assignment?.end_date ? null : input.active_assignment,
      assignment_history: input.active_assignment ? [input.active_assignment] : [],
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
    const existing = normalizeEmployee(employees[index]);
    let assignmentHistory = existing.assignment_history;
    let activeAssignment = existing.active_assignment;
    if (Object.prototype.hasOwnProperty.call(input, "active_assignment")) {
      const nextAssignment = input.active_assignment ?? null;
      if (nextAssignment && activeAssignment && nextAssignment.id !== activeAssignment.id) {
        assignmentHistory = [
          ...assignmentHistory.map((assignment) =>
            assignment.id === activeAssignment?.id
              ? { ...assignment, end_date: nextAssignment.start_date }
              : assignment,
          ),
          nextAssignment,
        ];
      } else if (nextAssignment) {
        const found = assignmentHistory.some((assignment) => assignment.id === nextAssignment.id);
        assignmentHistory = found
          ? assignmentHistory.map((assignment) => assignment.id === nextAssignment.id ? nextAssignment : assignment)
          : [...assignmentHistory, nextAssignment];
      }
      activeAssignment = nextAssignment?.end_date ? null : nextAssignment;
    }
    const employee: Employee = {
      ...existing,
      ...input,
      active_assignment: activeAssignment,
      assignment_history: assignmentHistory.sort((a, b) => b.start_date.localeCompare(a.start_date)),
      beneficiaries: (input.beneficiaries ?? employees[index].beneficiaries).map((beneficiary) => {
        const existingBeneficiary = employees[index].beneficiaries.find((item) => item.id === beneficiary.id);
        return {
          ...beneficiary,
          deactivated_at: beneficiary.is_active ? null : existingBeneficiary?.deactivated_at ?? timestamp
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
