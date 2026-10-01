import { supabase } from "../../../database/supabase/client";
import type { Member, MemberInput } from "../../../types/member";
import type { ListOptions } from "../Repository";
import type { MemberRepository } from "../MemberRepository";
import type { Beneficiary, BeneficiaryInput } from "../../../types/beneficiary";

type MemberRow = Omit<Member, "beneficiaries"> & { beneficiaries?: Beneficiary[] };

function normalize(row: MemberRow): Member {
  return { ...row, beneficiaries: row.beneficiaries ?? [] };
}

function memberFields(input: MemberInput | Partial<MemberInput>) {
  return Object.fromEntries(Object.entries(input).filter(([field]) => field !== "beneficiaries"));
}

async function saveBeneficiaries(memberId: string, beneficiaries?: BeneficiaryInput[]) {
  if (!beneficiaries) return;
  const client = requireSupabase();
  const rows = beneficiaries.map((beneficiary) => ({
    ...beneficiary, member_id: memberId, employee_id: null,
    deactivated_at: beneficiary.is_active ? null : new Date().toISOString(), sync_status: "synced",
  }));
  if (rows.length) {
    const { error } = await client.from("beneficiaries").upsert(rows);
    if (error) throw error;
  }
}

function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  return supabase;
}

export class SupabaseMemberRepository implements MemberRepository {
  async listPage(options: ListOptions = {}) {
    const client = requireSupabase();
    const placement = Boolean(options.branchId || options.clientId);
    const selection = placement ? "*, beneficiaries(*), employees!inner(employment_assignments!inner(branch_id,client_id,end_date))" : "*, beneficiaries(*)";
    let query = client.from("members").select(selection, { count: "exact" });
    if (!options.includeDeleted) query = query.is("deleted_at", null);
    if (options.search) { const term = `%${options.search}%`; query = query.or(`membership_number.ilike.${term},first_name.ilike.${term},last_name.ilike.${term}`); }
    if (options.statusId) query = query.eq("membership_status_id", options.statusId);
    if (options.typeId) query = query.eq("membership_type_id", options.typeId);
    if (options.approvalStatus) query = query.eq("bod_approval_status", options.approvalStatus);
    if (options.branchId) query = query.eq("employees.employment_assignments.branch_id", options.branchId).is("employees.employment_assignments.end_date", null);
    if (options.clientId) query = query.eq("employees.employment_assignments.client_id", options.clientId).is("employees.employment_assignments.end_date", null);
    const [column, ascending] = options.sort === "name-desc" ? ["last_name", false] : options.sort === "number-asc" ? ["membership_number", true] : options.sort === "joined-desc" ? ["membership_date", false] : ["last_name", true];
    query = query.order(column, { ascending });
    if (options.limit) query = query.range(options.offset ?? 0, (options.offset ?? 0) + options.limit - 1);
    const { data, error, count } = await query;
    if (error) throw error;
    return { items: (data as unknown as MemberRow[]).map(normalize), total: count ?? 0 };
  }

  async list(options: ListOptions = {}) {
    const client = requireSupabase();
    let query = client.from("members").select("*, beneficiaries(*)").order("updated_at", { ascending: false });

    if (!options.includeDeleted) {
      query = query.is("deleted_at", null);
    }

    if (options.search) {
      const term = `%${options.search}%`;
      query = query.or(
        `membership_number.ilike.${term},first_name.ilike.${term},last_name.ilike.${term}`
      );
    }

    if (options.limit) {
      query = query.range(options.offset ?? 0, (options.offset ?? 0) + options.limit - 1);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data as MemberRow[]).map(normalize);
  }

  async getById(id: string) {
    const client = requireSupabase();
    const { data, error } = await client.from("members").select("*, beneficiaries(*)").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? normalize(data as MemberRow) : null;
  }

  async findByMembershipNumber(membershipNumber: string) {
    const client = requireSupabase();
    const { data, error } = await client
      .from("members")
      .select("*, beneficiaries(*)")
      .eq("membership_number", membershipNumber)
      .maybeSingle();
    if (error) throw error;
    return data ? normalize(data as MemberRow) : null;
  }

  async create(input: MemberInput) {
    const client = requireSupabase();
    const { data, error } = await client
      .from("members")
      .insert({ ...memberFields(input), sync_status: "synced" })
      .select("*")
      .single();
    if (error) throw error;
    await saveBeneficiaries(data.id as string, input.beneficiaries);
    return (await this.getById(data.id as string))!;
  }

  async update(id: string, input: Partial<MemberInput>) {
    const client = requireSupabase();
    const { error } = await client
      .from("members")
      .update({ ...memberFields(input), updated_at: new Date().toISOString(), sync_status: "synced" })
      .eq("id", id);
    if (error) throw error;
    await saveBeneficiaries(id, input.beneficiaries);
    return (await this.getById(id))!;
  }

  async archive(id: string) {
    const client = requireSupabase();
    const { error } = await client
      .from("members")
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sync_status: "synced"
      })
      .eq("id", id);
    if (error) throw error;
  }

  async restore(id: string) {
    const client = requireSupabase();
    const { data, error } = await client
      .from("members")
      .update({ deleted_at: null, updated_at: new Date().toISOString(), sync_status: "synced" })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return normalize(data as MemberRow);
  }
}
