import { supabase } from "../../../database/supabase/client";
import type { Member, MemberInput } from "../../../types/member";
import type { ListOptions } from "../Repository";
import type { MemberRepository } from "../MemberRepository";

function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  return supabase;
}

export class SupabaseMemberRepository implements MemberRepository {
  async list(options: ListOptions = {}) {
    const client = requireSupabase();
    let query = client.from("members").select("*").order("updated_at", { ascending: false });

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
    return data as Member[];
  }

  async getById(id: string) {
    const client = requireSupabase();
    const { data, error } = await client.from("members").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data as Member | null;
  }

  async findByMembershipNumber(membershipNumber: string) {
    const client = requireSupabase();
    const { data, error } = await client
      .from("members")
      .select("*")
      .eq("membership_number", membershipNumber)
      .maybeSingle();
    if (error) throw error;
    return data as Member | null;
  }

  async create(input: MemberInput) {
    const client = requireSupabase();
    const { data, error } = await client
      .from("members")
      .insert({ ...input, sync_status: "synced" })
      .select("*")
      .single();
    if (error) throw error;
    return data as Member;
  }

  async update(id: string, input: Partial<MemberInput>) {
    const client = requireSupabase();
    const { data, error } = await client
      .from("members")
      .update({ ...input, updated_at: new Date().toISOString(), sync_status: "synced" })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return data as Member;
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
    return data as Member;
  }
}
