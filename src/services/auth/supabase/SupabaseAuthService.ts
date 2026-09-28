import { supabase } from "../../../database/supabase/client";
import type { RoleCode } from "../../access/accessControl";
import type { AuthService, AuthSession } from "../types";

type ProfileRow = {
  id: string;
  email: string;
  display_name: string;
  is_active: boolean;
  user_roles?: Array<{ roles: { code: RoleCode } | Array<{ code: RoleCode }> | null }>;
  user_branch_access?: Array<{ branch_id: string }>;
};

async function loadSession(): Promise<AuthSession | null> {
  if (!supabase) return null;
  const { data: authData } = await supabase.auth.getSession();
  const authUser = authData.session?.user;
  if (!authUser) return null;
  const { data, error } = await supabase.from("users").select("id,email,display_name,is_active,user_roles(roles(code)),user_branch_access(branch_id)").eq("id", authUser.id).single();
  if (error) throw new Error("Your account profile could not be loaded.");
  const row = data as unknown as ProfileRow;
  if (!row.is_active) {
    await supabase.auth.signOut();
    throw new Error("Your account is inactive.");
  }
  const roleValue = row.user_roles?.[0]?.roles;
  const role = (Array.isArray(roleValue) ? roleValue[0]?.code : roleValue?.code) ?? "branch_user";
  return {
    profile: { userId: row.id, displayName: row.display_name, role, branchIds: row.user_branch_access?.map((item) => item.branch_id) ?? [] },
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
