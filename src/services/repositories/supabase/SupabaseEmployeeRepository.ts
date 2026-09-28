import { supabase } from "../../../database/supabase/client";
import type { Beneficiary, BeneficiaryInput } from "../../../types/beneficiary";
import type { Employee, EmployeeInput } from "../../../types/employee";
import type { EmploymentAssignment } from "../../../types/assignment";
import type { EmployeeRepository } from "../EmployeeRepository";
import type { ListOptions } from "../Repository";

type EmployeeRow = Omit<Employee, "beneficiaries" | "active_assignment"> & {
  beneficiaries?: Beneficiary[];
  employment_assignments?: EmploymentAssignment[];
};

function client() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

function normalize(row: EmployeeRow): Employee {
  return {
    ...row,
    beneficiaries: row.beneficiaries ?? [],
    active_assignment:
      row.employment_assignments?.find((assignment) => !assignment.end_date) ?? null
  };
}

function employeeFields(input: EmployeeInput | Partial<EmployeeInput>) {
  const relationFields = new Set(["beneficiaries", "active_assignment"]);
  return Object.fromEntries(
    Object.entries(input).filter(([field]) => !relationFields.has(field))
  );
}

async function saveRelations(employeeId: string, input: Partial<EmployeeInput>) {
  const db = client();
  if (input.beneficiaries) {
    const rows = input.beneficiaries.map((beneficiary: BeneficiaryInput) => ({
      ...beneficiary,
      employee_id: employeeId,
      member_id: null,
      deactivated_at: beneficiary.is_active ? null : new Date().toISOString(),
      sync_status: "synced"
    }));
    if (rows.length) {
      const { error } = await db.from("beneficiaries").upsert(rows);
      if (error) throw error;
    }
  }
  if (input.active_assignment) {
    const { error } = await db.from("employment_assignments").upsert({
      ...input.active_assignment,
      employee_id: employeeId,
      sync_status: "synced"
    });
    if (error) throw error;
  }
}

export class SupabaseEmployeeRepository implements EmployeeRepository {
  async list(options: ListOptions = {}) {
    let query = client()
      .from("employees")
      .select("*, beneficiaries(*), employment_assignments(*)")
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
    const { data, error } = await client().from("employees").select("*, beneficiaries(*), employment_assignments(*)").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? normalize(data as EmployeeRow) : null;
  }

  async findByEmployeeNumber(employeeNumber: string) {
    const { data, error } = await client().from("employees").select("*, beneficiaries(*), employment_assignments(*)").eq("employee_number", employeeNumber).maybeSingle();
    if (error) throw error;
    return data ? normalize(data as EmployeeRow) : null;
  }

  async create(input: EmployeeInput) {
    const { data, error } = await client().from("employees").insert({ ...employeeFields(input), sync_status: "synced" }).select("*").single();
    if (error) throw error;
    await saveRelations(data.id as string, input);
    return (await this.getById(data.id as string))!;
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
