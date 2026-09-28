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
    const { data: allowed } = await anon.rpc("current_user_has_role", { role_codes: ["super_admin"] });
    if (!allowed) throw new Error("Only Super Admin can invite users.");

    const input = await request.json();
    const service = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: invitation, error: inviteError } = await service.auth.admin.inviteUserByEmail(input.email.trim().toLowerCase(), {
      data: { display_name: input.display_name.trim(), must_change_password: true },
    });
    if (inviteError || !invitation.user) throw inviteError ?? new Error("User invitation failed.");
    const userId = invitation.user.id;
    await service.from("users").upsert({ id: userId, email: input.email.trim().toLowerCase(), display_name: input.display_name.trim(), is_active: input.is_active });
    const { data: role, error: roleLookupError } = await service.from("roles").select("id").eq("code", input.role).single();
    if (roleLookupError || !role) throw roleLookupError ?? new Error("Role was not found.");
    await service.from("user_roles").delete().eq("user_id", userId);
    const { error: roleError } = await service.from("user_roles").insert({ user_id: userId, role_id: role.id });
    if (roleError) throw roleError;
    if (input.branch_ids?.length) {
      const { error: branchError } = await service.from("user_branch_access").insert(input.branch_ids.map((branch_id: string) => ({ user_id: userId, branch_id })));
      if (branchError) throw branchError;
    }
    return new Response(JSON.stringify({ id: userId, email: input.email.trim().toLowerCase(), display_name: input.display_name.trim(), role: input.role, branch_ids: input.branch_ids ?? [], is_active: input.is_active, created_at: invitation.user.created_at, updated_at: invitation.user.updated_at ?? invitation.user.created_at }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : "Invitation failed.";
    return new Response(JSON.stringify({ error: message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
