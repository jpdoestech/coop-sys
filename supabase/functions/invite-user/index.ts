import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) throw new Error("Authentication is required.");
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authorization } } });
    const { data: caller } = await anon.auth.getUser();
    if (!caller.user) throw new Error("Authentication is required.");
    const { data: allowed } = await anon.rpc("current_user_has_permission", { permission_code: "users.create" });
    if (!allowed) throw new Error("Your effective access does not permit creating users.");

    const input = await request.json();
    const service = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: invitation, error: inviteError } = await service.auth.admin.inviteUserByEmail(input.email.trim().toLowerCase(), {
      data: { display_name: input.display_name.trim(), must_change_password: true },
    });
    if (inviteError || !invitation.user) throw inviteError ?? new Error("User invitation failed.");
    const userId = invitation.user.id;
    await service.from("users").upsert({ id: userId, email: input.email.trim().toLowerCase(), display_name: input.display_name.trim(), is_active: input.is_active, scope_type: input.scope_type, employee_id: input.linked_employee_id || null, manager_user_id: input.manager_user_id || null });
    await service.from("user_roles").delete().eq("user_id", userId);
    const { error: roleError } = await service.from("user_roles").insert((input.role_ids ?? []).map((role_id: string) => ({ user_id: userId, role_id })));
    if (roleError) throw roleError;
    if (input.branch_ids?.length) {
      const { error: branchError } = await service.from("user_branch_access").insert(input.branch_ids.map((branch_id: string) => ({ user_id: userId, branch_id })));
      if (branchError) throw branchError;
    }
    if (input.client_ids?.length) await service.from("user_client_access").insert(input.client_ids.map((client_id: string) => ({ user_id: userId, client_id })));
    const overrides = [...(input.direct_grants ?? []).map((permission: string) => ({ user_id: userId, permission, effect: "grant" })), ...(input.direct_denies ?? []).map((permission: string) => ({ user_id: userId, permission, effect: "deny" }))];
    if (overrides.length) await service.from("user_permission_overrides").insert(overrides);
    if (input.resource_assignments?.length) await service.from("user_resource_assignments").insert(input.resource_assignments.map((resource_key: string) => ({ user_id: userId, resource_key })));
    return new Response(JSON.stringify({ id: userId, email: input.email.trim().toLowerCase(), display_name: input.display_name.trim(), role: input.role, role_ids: input.role_ids ?? [], branch_ids: input.branch_ids ?? [], client_ids: input.client_ids ?? [], direct_grants: input.direct_grants ?? [], direct_denies: input.direct_denies ?? [], scope_type: input.scope_type, resource_assignments: input.resource_assignments ?? [], linked_employee_id: input.linked_employee_id ?? null, manager_user_id: input.manager_user_id ?? null, is_active: input.is_active, created_at: invitation.user.created_at, updated_at: invitation.user.updated_at ?? invitation.user.created_at }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : "Invitation failed.";
    return new Response(JSON.stringify({ error: message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
