import { supabase } from "../../../database/supabase/client";
import type { RoleCode } from "../../access/accessControl";
import type { SystemUser, SystemUserInput } from "../../../types/systemUser";
import type { UserAccessRepository } from "../UserAccessRepository";

type UserRow = {
  id: string;
  email: string;
  display_name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  user_roles?: Array<{ roles: { code: RoleCode } | Array<{ code: RoleCode }> | null }>;
  user_branch_access?: Array<{ branch_id: string }>;
};

function toSystemUser(row: UserRow): SystemUser {
  const roleValue = row.user_roles?.[0]?.roles;
  const role = (Array.isArray(roleValue) ? roleValue[0]?.code : roleValue?.code) ?? "branch_user";
  return { id: row.id, email: row.email, display_name: row.display_name, is_active: row.is_active, role, branch_ids: row.user_branch_access?.map((item) => item.branch_id) ?? [], created_at: row.created_at, updated_at: row.updated_at };
}

export class SupabaseUserAccessRepository implements UserAccessRepository {
  async list() {
    if (!supabase) return [];
    const { data, error } = await supabase.from("users").select("id,email,display_name,is_active,created_at,updated_at,user_roles(roles(code)),user_branch_access(branch_id)").is("deleted_at", null).order("display_name");
    if (error) throw error;
    return (data as unknown as UserRow[]).map(toSystemUser);
  }

  async create(input: SystemUserInput) {
    if (!supabase) throw new Error("Supabase is not configured.");
    const { data, error } = await supabase.functions.invoke("invite-user", { body: input });
    if (error) throw new Error(error.message);
    return data as SystemUser;
  }

  async update(id: string, input: SystemUserInput) {
    if (!supabase) throw new Error("Supabase is not configured.");
    const { data: role } = await supabase.from("roles").select("id").eq("code", input.role).single();
    if (!role) throw new Error("The selected role is unavailable.");
    const { error: userError } = await supabase.from("users").update({ display_name: input.display_name, is_active: input.is_active, updated_at: new Date().toISOString() }).eq("id", id);
    if (userError) throw userError;
    await supabase.from("user_roles").delete().eq("user_id", id);
    const { error: roleError } = await supabase.from("user_roles").insert({ user_id: id, role_id: role.id });
    if (roleError) throw roleError;
    await supabase.from("user_branch_access").delete().eq("user_id", id);
    if (input.branch_ids.length) {
      const { error: branchError } = await supabase.from("user_branch_access").insert(input.branch_ids.map((branch_id) => ({ user_id: id, branch_id })));
      if (branchError) throw branchError;
    }
    if (input.temporary_password) throw new Error("Send online password resets from the sign-in screen; passwords are never handled by the administrator browser.");
    return (await this.list()).find((user) => user.id === id)!;
  }
}
