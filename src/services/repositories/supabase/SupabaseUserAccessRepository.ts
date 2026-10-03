import { supabase } from "../../../database/supabase/client";
import type { AccessRole, RoleCode } from "../../access/accessControl";
import { normalizeSystemUser } from "../../access/userAccessModel";
import type { SystemUser, SystemUserInput } from "../../../types/systemUser";
import type {
  AccessRoleInput,
  UserAccessRepository,
  UserListOptions,
} from "../UserAccessRepository";

type UserRow = {
  id: string;
  email: string;
  display_name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  scope_type?: SystemUser["scope_type"];
  employee_id?: string | null;
  manager_user_id?: string | null;
  user_roles?: Array<{
    role_id?: string;
    roles: { id: string; code: RoleCode } | Array<{ id: string; code: RoleCode }> | null;
  }>;
  user_branch_access?: Array<{ branch_id: string }>;
  user_client_access?: Array<{ client_id: string }>;
  user_permission_overrides?: Array<{ permission: string; effect: "grant" | "deny" }>;
  user_resource_assignments?: Array<{ resource_key: string }>;
};

const userSelect = "id,email,display_name,is_active,scope_type,employee_id,manager_user_id,created_at,updated_at,user_roles(role_id,roles(id,code)),user_branch_access(branch_id),user_client_access(client_id),user_permission_overrides(permission,effect),user_resource_assignments(resource_key)";

function toSystemUser(row: UserRow): SystemUser {
  const roleValue = row.user_roles?.[0]?.roles;
  const role =
    (Array.isArray(roleValue) ? roleValue[0]?.code : roleValue?.code) ??
    "branch_user";
  return normalizeSystemUser({
    id: row.id,
    email: row.email,
    display_name: row.display_name,
    is_active: row.is_active,
    role,
    role_ids: row.user_roles?.map((item) => item.role_id ?? (Array.isArray(item.roles) ? item.roles[0]?.id : item.roles?.id)).filter((id): id is string => Boolean(id)) ?? [],
    branch_ids: row.user_branch_access?.map((item) => item.branch_id) ?? [],
    client_ids: row.user_client_access?.map((item) => item.client_id) ?? [],
    direct_grants: row.user_permission_overrides?.filter((item) => item.effect === "grant").map((item) => item.permission) ?? [],
    direct_denies: row.user_permission_overrides?.filter((item) => item.effect === "deny").map((item) => item.permission) ?? [],
    scope_type: row.scope_type ?? "organization",
    resource_assignments: row.user_resource_assignments?.map((item) => item.resource_key) ?? [],
    linked_employee_id: row.employee_id ?? null,
    manager_user_id: row.manager_user_id ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  });
}

export class SupabaseUserAccessRepository implements UserAccessRepository {
  async listPage(options: UserListOptions = {}) {
    if (!supabase) return { items: [], total: 0 };
    let query = supabase
      .from("users")
      .select(
        userSelect,
        { count: "exact" },
      )
      .is("deleted_at", null);
    if (options.search) {
      const term = `%${options.search.trim()}%`;
      query = query.or(`display_name.ilike.${term},email.ilike.${term}`);
    }
    if (options.status && options.status !== "all")
      query = query.eq("is_active", options.status === "active");
    query = query.order("display_name");
    if (options.limit)
      query = query.range(
        options.offset ?? 0,
        (options.offset ?? 0) + options.limit - 1,
      );
    const { data, error, count } = await query;
    if (error) throw error;
    return {
      items: (data as unknown as UserRow[]).map(toSystemUser),
      total: count ?? 0,
    };
  }

  async create(input: SystemUserInput) {
    if (!supabase) throw new Error("Supabase is not configured.");
    const { data, error } = await supabase.functions.invoke("invite-user", {
      body: input,
    });
    if (error) throw new Error(error.message);
    return data as SystemUser;
  }

  async update(id: string, input: SystemUserInput) {
    if (!supabase) throw new Error("Supabase is not configured.");
    const { error: userError } = await supabase
      .from("users")
      .update({
        display_name: input.display_name,
        is_active: input.is_active,
        scope_type: input.scope_type,
        employee_id: input.linked_employee_id,
        manager_user_id: input.manager_user_id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (userError) throw userError;
    await supabase.from("user_roles").delete().eq("user_id", id);
    const { error: roleError } = await supabase.from("user_roles").insert(input.role_ids.map((role_id) => ({ user_id: id, role_id })));
    if (roleError) throw roleError;
    await supabase.from("user_branch_access").delete().eq("user_id", id);
    if (input.branch_ids.length) {
      const { error: branchError } = await supabase
        .from("user_branch_access")
        .insert(
          input.branch_ids.map((branch_id) => ({ user_id: id, branch_id })),
        );
      if (branchError) throw branchError;
    }
    await supabase.from("user_client_access").delete().eq("user_id", id);
    if (input.client_ids.length) {
      const { error } = await supabase.from("user_client_access").insert(input.client_ids.map((client_id) => ({ user_id: id, client_id })));
      if (error) throw error;
    }
    await supabase.from("user_permission_overrides").delete().eq("user_id", id);
    const overrides = [...input.direct_grants.map((permission) => ({ user_id: id, permission, effect: "grant" })), ...input.direct_denies.map((permission) => ({ user_id: id, permission, effect: "deny" }))];
    if (overrides.length) { const { error } = await supabase.from("user_permission_overrides").insert(overrides); if (error) throw error; }
    await supabase.from("user_resource_assignments").delete().eq("user_id", id);
    if (input.resource_assignments.length) { const { error } = await supabase.from("user_resource_assignments").insert(input.resource_assignments.map((resource_key) => ({ user_id: id, resource_key }))); if (error) throw error; }
    if (input.temporary_password)
      throw new Error(
        "Send online password resets from the sign-in screen; passwords are never handled by the administrator browser.",
      );
    const { data, error } = await supabase
      .from("users")
      .select(
        userSelect,
      )
      .eq("id", id)
      .single();
    if (error) throw error;
    return toSystemUser(data as unknown as UserRow);
  }

  async listRoles() {
    if (!supabase) return [];
    const { data, error } = await supabase.from("roles").select("id,code,name,description,permissions,is_active,is_system,created_at,updated_at").order("name");
    if (error) throw error;
    return data as AccessRole[];
  }

  async createRole(input: AccessRoleInput) {
    if (!supabase) throw new Error("Supabase is not configured.");
    const code = input.code.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    const { data, error } = await supabase.from("roles").insert({ ...input, code, is_system: false }).select().single();
    if (error) throw error;
    return data as AccessRole;
  }

  async updateRole(id: string, input: AccessRoleInput) {
    if (!supabase) throw new Error("Supabase is not configured.");
    const updates = { name: input.name, description: input.description, permissions: input.permissions, is_active: input.is_active };
    const { data, error } = await supabase.from("roles").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id).eq("is_system", false).select().single();
    if (error) throw error;
    return data as AccessRole;
  }

  async deleteRole(id: string) {
    if (!supabase) throw new Error("Supabase is not configured.");
    const { error } = await supabase.from("roles").delete().eq("id", id).eq("is_system", false);
    if (error) throw error;
  }
}
