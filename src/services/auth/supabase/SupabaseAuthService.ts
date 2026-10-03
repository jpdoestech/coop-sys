import { supabase } from "../../../database/supabase/client";
import { effectivePermissionSet, type Permission, type RoleCode } from "../../access/accessControl";
import type { AuthService, AuthSession } from "../types";

type ProfileRow = {
  id: string;
  email: string;
  display_name: string;
  is_active: boolean;
  scope_type?: "organization" | "assigned_branches" | "assigned_clients" | "self";
  employee_id?: string | null;
  manager_user_id?: string | null;
  user_roles?: Array<{ role_id: string; roles: { code: RoleCode; name: string; permissions: Permission[]; is_active: boolean } | Array<{ code: RoleCode; name: string; permissions: Permission[]; is_active: boolean }> | null }>;
  user_branch_access?: Array<{ branch_id: string }>;
  user_client_access?: Array<{ client_id: string }>;
  user_permission_overrides?: Array<{ permission: Permission; effect: "grant" | "deny" }>;
};

async function loadSession(): Promise<AuthSession | null> {
  if (!supabase) return null;
  const { data: authData } = await supabase.auth.getSession();
  const authUser = authData.session?.user;
  if (!authUser) return null;
  const { data, error } = await supabase.from("users").select("id,email,display_name,is_active,scope_type,employee_id,manager_user_id,user_roles(role_id,roles(code,name,permissions,is_active)),user_branch_access(branch_id),user_client_access(client_id),user_permission_overrides(permission,effect)").eq("id", authUser.id).single();
  if (error?.code === "PGRST205") {
    throw new Error("The Supabase database is not initialized. Run the project migrations, then sign in again.");
  }
  if (error?.code === "PGRST116") {
    throw new Error("Your Supabase Auth user has no application profile. Run the authentication profile migration, then sign in again.");
  }
  if (error) throw new Error("Your account profile could not be loaded.");
  const row = data as unknown as ProfileRow;
  if (!row.is_active) {
    await supabase.auth.signOut();
    throw new Error("Your account is inactive.");
  }
  const assignedRoles = (row.user_roles ?? []).map((assignment) => Array.isArray(assignment.roles) ? assignment.roles[0] : assignment.roles).filter((role): role is NonNullable<typeof role> => Boolean(role?.is_active));
  const role = assignedRoles[0]?.code ?? "branch_user";
  const grants = row.user_permission_overrides?.filter((item) => item.effect === "grant").map((item) => item.permission) ?? [];
  const denies = row.user_permission_overrides?.filter((item) => item.effect === "deny").map((item) => item.permission) ?? [];
  const permissions = role === "super_admin" ? assignedRoles.flatMap((item) => item.permissions) : [...effectivePermissionSet(assignedRoles.flatMap((item) => item.permissions), grants, denies)];
  return {
    profile: { userId: row.id, displayName: row.display_name, role, roleIds: row.user_roles?.map((item) => item.role_id) ?? [], roleLabels: assignedRoles.map((item) => item.name), branchIds: row.user_branch_access?.map((item) => item.branch_id) ?? [], clientIds: row.user_client_access?.map((item) => item.client_id) ?? [], scopeType: row.scope_type ?? "organization", linkedEmployeeId: row.employee_id ?? null, managerUserId: row.manager_user_id ?? null, directGrants: grants, directDenies: denies, effectivePermissions: permissions },
    email: row.email,
    mode: "online",
    mustChangePassword: Boolean(authUser.user_metadata.must_change_password),
  };
}

export class SupabaseAuthService implements AuthService {
  async getSession() { return loadSession(); }

  async signIn(email: string, password: string) {
    if (!supabase) throw new Error("Supabase is not configured.");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) throw new Error("Email or password is incorrect.");
    const session = await loadSession();
    if (!session) throw new Error("Authentication session could not be created.");
    return session;
  }

  async signOut() {
    if (supabase) await supabase.auth.signOut();
  }

  async changePassword(password: string) {
    if (!supabase) throw new Error("Supabase is not configured.");
    const { error } = await supabase.auth.updateUser({ password, data: { must_change_password: false } });
    if (error) throw new Error(error.message);
    const session = await loadSession();
    if (!session) throw new Error("Authentication session could not be refreshed.");
    return session;
  }

  async requestPasswordReset(email: string) {
    if (!supabase) throw new Error("Supabase is not configured.");
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: window.location.origin });
    if (error) throw new Error(error.message);
  }

  subscribe(callback: (session: AuthSession | null) => void) {
    if (!supabase) return () => undefined;
    const { data } = supabase.auth.onAuthStateChange((event) => {
      window.setTimeout(() => void loadSession().then((session) => callback(session && event === "PASSWORD_RECOVERY" ? { ...session, mustChangePassword: true } : session)).catch(() => callback(null)), 0);
    });
    return () => data.subscription.unsubscribe();
  }
}
