import { developmentEmployees } from "../../../database/seeds/employeeSeed";
import type { Employee, EmployeeInput } from "../../../types/employee";
import type { EmployeeRepository } from "../EmployeeRepository";
import type { ListOptions } from "../Repository";
import type { Beneficiary, BeneficiaryInput } from "../../../types/beneficiary";
import { readStoredMembers, writeStoredMembers } from "./memberStorage";
import { normalizePersonNumber } from "../../identity/personNumber";

const STORAGE_KEY = "coop_sys_employees";

function now() {
  return new Date().toISOString();
}

function writeEmployees(employees: Employee[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(employees));
}

function normalizeBeneficiaries(input: BeneficiaryInput[], existing: Beneficiary[], timestamp: string): Beneficiary[] {
  return input.map((beneficiary) => ({
    ...beneficiary,
    deactivated_at: beneficiary.is_active ? null : existing.find((item) => item.id === beneficiary.id)?.deactivated_at ?? timestamp,
  }));
}

function saveMemberBeneficiaries(memberId: string, input: BeneficiaryInput[], timestamp: string) {
  const members = readStoredMembers();
  const index = members.findIndex((member) => member.id === memberId);
  if (index === -1) return normalizeBeneficiaries(input, [], timestamp);
  const beneficiaries = normalizeBeneficiaries(input, members[index].beneficiaries, timestamp);
  members[index] = {
    ...members[index], beneficiaries, number_of_dependents: beneficiaries.filter((item) => item.is_active).length,
    updated_at: timestamp, sync_status: members[index].sync_status === "pending_create" ? "pending_create" : "pending_update",
  };
  writeStoredMembers(members);
  return beneficiaries;
}

function linkedMemberIdentity(employee: Employee) {
  if (!employee.member_id) return null;
  const members = readStoredMembers();
  const index = members.findIndex((member) => member.id === employee.member_id);
  if (index === -1) return null;
  if (!members[index].beneficiaries.length && employee.beneficiaries?.length) {
    members[index] = {
      ...members[index],
      beneficiaries: employee.beneficiaries,
      number_of_dependents: employee.beneficiaries.filter((item) => item.is_active).length,
    };
    writeStoredMembers(members);
  }
  return members[index];
}

function normalizeEmployee(employee: Employee): Employee {
  const linkedMember = linkedMemberIdentity(employee);
  const history = (employee.assignment_history ?? (employee.active_assignment ? [employee.active_assignment] : []))
    .map((assignment) => ({ ...assignment, transfer_reason: assignment.transfer_reason ?? null }))
    .sort((a, b) => b.start_date.localeCompare(a.start_date));
  return {
    ...employee,
    employee_number: linkedMember?.membership_number ?? normalizePersonNumber(employee.employee_number),
    beneficiaries: linkedMember?.beneficiaries ?? employee.beneficiaries ?? [],
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
  private filtered(options: ListOptions = {}) {
    let employees = readEmployees();
    if (!options.includeDeleted) employees = employees.filter((employee) => !employee.deleted_at);
    if (options.search) { const search = options.search.toLowerCase(); employees = employees.filter((employee) => [employee.employee_number, employee.first_name, employee.last_name, employee.work_location].join(" ").toLowerCase().includes(search)); }
    if (options.statusId) employees = employees.filter((employee) => employee.employment_status_id === options.statusId);
    if (options.departmentId) employees = employees.filter((employee) => employee.department_id === options.departmentId);
    if (options.branchId) employees = employees.filter((employee) => employee.active_assignment?.branch_id === options.branchId);
    if (options.clientId) employees = employees.filter((employee) => employee.active_assignment?.client_id === options.clientId);
    return employees.sort((a, b) => options.sort === "name-desc" ? b.last_name.localeCompare(a.last_name) : options.sort === "number-asc" ? a.employee_number.localeCompare(b.employee_number) : options.sort === "hired-desc" ? (b.date_hired ?? "").localeCompare(a.date_hired ?? "") : a.last_name.localeCompare(b.last_name));
  }

  async list(options: ListOptions = {}) {
    return this.filtered(options)
      .slice(options.offset ?? 0, options.limit ? (options.offset ?? 0) + options.limit : undefined);
  }

  async listPage(options: ListOptions = {}) { const records = this.filtered(options); const offset = options.offset ?? 0; return { items: records.slice(offset, options.limit ? offset + options.limit : undefined), total: records.length }; }

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
    const beneficiaries = input.member_id
      ? saveMemberBeneficiaries(input.member_id, input.beneficiaries, timestamp)
      : normalizeBeneficiaries(input.beneficiaries, [], timestamp);
    const employee: Employee = {
      ...input,
      beneficiaries,
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
    const memberId = Object.prototype.hasOwnProperty.call(input, "member_id") ? input.member_id ?? null : existing.member_id;
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
      beneficiaries: input.beneficiaries
        ? memberId
          ? saveMemberBeneficiaries(memberId, input.beneficiaries, timestamp)
          : normalizeBeneficiaries(input.beneficiaries, employees[index].beneficiaries, timestamp)
        : existing.beneficiaries,
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
