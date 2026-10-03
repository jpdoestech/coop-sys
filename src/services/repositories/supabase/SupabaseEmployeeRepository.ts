import { supabase } from "../../../database/supabase/client";
import type { Beneficiary, BeneficiaryInput } from "../../../types/beneficiary";
import type { Employee, EmployeeInput } from "../../../types/employee";
import type { EmploymentAssignment } from "../../../types/assignment";
import type { EmployeeRepository } from "../EmployeeRepository";
import type { ListOptions } from "../Repository";

type EmployeeRow = Omit<Employee, "beneficiaries" | "active_assignment" | "assignment_history"> & {
  beneficiaries?: Beneficiary[];
  employment_assignments?: EmploymentAssignment[];
  member?: { beneficiaries?: Beneficiary[] } | null;
};

function client() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

function normalize(row: EmployeeRow): Employee {
  const assignmentHistory = (row.employment_assignments ?? [])
    .sort((a, b) => b.start_date.localeCompare(a.start_date));
  return {
    ...row,
    beneficiaries: row.member?.beneficiaries ?? row.beneficiaries ?? [],
    active_assignment: assignmentHistory.find((assignment) => !assignment.end_date) ?? null,
    assignment_history: assignmentHistory,
  };
}

function employeeFields(input: EmployeeInput | Partial<EmployeeInput>) {
  const relationFields = new Set(["beneficiaries", "active_assignment", "assignment_history"]);
  return Object.fromEntries(
    Object.entries(input).filter(([field]) => !relationFields.has(field))
  );
}

async function saveRelations(employeeId: string, input: Partial<EmployeeInput>) {
  const db = client();
  if (input.beneficiaries) {
    const memberId = input.member_id ?? null;
    const rows = input.beneficiaries.map((beneficiary: BeneficiaryInput) => ({
      ...beneficiary,
      employee_id: memberId ? null : employeeId,
      member_id: memberId,
      deactivated_at: beneficiary.is_active ? null : new Date().toISOString(),
      sync_status: "synced"
    }));
    if (rows.length) {
      const { error } = await db.from("beneficiaries").upsert(rows);
      if (error) throw error;
    }
    if (memberId) {
      const { error } = await db.from("beneficiaries").delete().eq("employee_id", employeeId);
      if (error) throw error;
    }
  }
  if (input.active_assignment) {
    const { data: currentAssignments, error: currentError } = await db
      .from("employment_assignments")
      .select("id")
      .eq("employee_id", employeeId)
      .is("end_date", null)
      .neq("id", input.active_assignment.id);
    if (currentError) throw currentError;
    if (currentAssignments?.length) {
      const { error: closeError } = await db
        .from("employment_assignments")
        .update({ end_date: input.active_assignment.start_date, updated_at: new Date().toISOString() })
        .in("id", currentAssignments.map((assignment) => assignment.id));
      if (closeError) throw closeError;
    }
    const { error } = await db.from("employment_assignments").upsert({
      ...input.active_assignment,
      employee_id: employeeId,
      sync_status: "synced"
    });
    if (error) throw error;
  }
}

export class SupabaseEmployeeRepository implements EmployeeRepository {
  async listPage(options: ListOptions = {}) {
    const placement = Boolean(options.branchId || options.clientId);
    const assignmentRelation = placement ? "employment_assignments!inner(*)" : "employment_assignments(*)";
    let query = client().from("employees").select(`*, beneficiaries(*), ${assignmentRelation}, member:members(beneficiaries(*))`, { count: "exact" });
    if (!options.includeDeleted) query = query.is("deleted_at", null);
    if (options.search) { const term = `%${options.search}%`; query = query.or(`employee_number.ilike.${term},first_name.ilike.${term},last_name.ilike.${term}`); }
    if (options.statusId) query = query.eq("employment_status_id", options.statusId);
    if (options.departmentId) query = query.eq("department_id", options.departmentId);
    if (options.branchId) query = query.eq("employment_assignments.branch_id", options.branchId).is("employment_assignments.end_date", null);
    if (options.clientId) query = query.eq("employment_assignments.client_id", options.clientId).is("employment_assignments.end_date", null);
    const [column, ascending] = options.sort === "name-desc" ? ["last_name", false] : options.sort === "number-asc" ? ["employee_number", true] : options.sort === "hired-desc" ? ["date_hired", false] : ["last_name", true];
    query = query.order(column, { ascending });
    if (options.limit) query = query.range(options.offset ?? 0, (options.offset ?? 0) + options.limit - 1);
    const { data, error, count } = await query;
    if (error) throw error;
    return { items: (data as EmployeeRow[]).map(normalize), total: count ?? 0 };
  }

  async list(options: ListOptions = {}) {
    let query = client()
      .from("employees")
      .select("*, beneficiaries(*), employment_assignments(*), member:members(beneficiaries(*))")
      .order("updated_at", { ascending: false });
    if (!options.includeDeleted) query = query.is("deleted_at", null);
    if (options.search) {
      const term = `%${options.search}%`;
      query = query.or(`employee_number.ilike.${term},first_name.ilike.${term},last_name.ilike.${term}`);
    }
    if (options.limit) query = query.range(options.offset ?? 0, (options.offset ?? 0) + options.limit - 1);
    const { data, error } = await query;
    if (error) throw error;
    return (data as EmployeeRow[]).map(normalize);
  }

  async getById(id: string) {
    const { data, error } = await client().from("employees").select("*, beneficiaries(*), employment_assignments(*), member:members(beneficiaries(*))").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? normalize(data as EmployeeRow) : null;
  }

  async findByEmployeeNumber(employeeNumber: string) {
    const { data, error } = await client().from("employees").select("*, beneficiaries(*), employment_assignments(*), member:members(beneficiaries(*))").eq("employee_number", employeeNumber).maybeSingle();
    if (error) throw error;
    return data ? normalize(data as EmployeeRow) : null;
  }

  async listByMemberId(memberId: string) {
    const { data, error } = await client().from("employees").select("*, beneficiaries(*), employment_assignments(*), member:members(beneficiaries(*))").eq("member_id", memberId);
    if (error) throw error;
    return (data as EmployeeRow[]).map(normalize);
  }

  async create(input: EmployeeInput) {
    const db = client();
    const { data, error } = await db.from("employees").insert({ ...employeeFields(input), sync_status: "synced" }).select("*").single();
    let employeeId = data?.id as string | undefined;
    if (error) {
      if (error.code !== "23505" || !input.active_assignment) throw error;
      const recovery = await db.rpc("recover_unassigned_employee", {
        p_employee_number: input.employee_number,
        p_member_id: input.member_id,
        p_assignment: input.active_assignment,
      });
      if (recovery.error) throw recovery.error;
      employeeId = recovery.data as string;
    }
    if (!employeeId) throw new Error("The employee record could not be created.");
    await saveRelations(employeeId, input);
    return (await this.getById(employeeId))!;
  }

  async update(id: string, input: Partial<EmployeeInput>) {
    const { error } = await client().from("employees").update({ ...employeeFields(input), updated_at: new Date().toISOString(), sync_status: "synced" }).eq("id", id);
    if (error) throw error;
    await saveRelations(id, input);
    return (await this.getById(id))!;
  }

  async archive(id: string) {
    const timestamp = new Date().toISOString();
    const { error } = await client().from("employees").update({ deleted_at: timestamp, updated_at: timestamp, sync_status: "synced" }).eq("id", id);
    if (error) throw error;
  }

  async restore(id: string) {
    const { error } = await client().from("employees").update({ deleted_at: null, updated_at: new Date().toISOString(), sync_status: "synced" }).eq("id", id);
    if (error) throw error;
    return (await this.getById(id))!;
  }
}
