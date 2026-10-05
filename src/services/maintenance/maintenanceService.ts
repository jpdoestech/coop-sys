import { supabase, isSupabaseConfigured } from "../../database/supabase/client";
import { getAppMode } from "../../utils/env";
import type { AccessProfile } from "../access/accessControl";
import { flushDatabaseStorage, hydrateDatabaseStorage } from "../server/databaseStorage";
import { serverRequest, usesServerBackend } from "../server/serverApi";
import { applyCleanup, listCleanupRecords, type CleanupListItem, type CleanupListOptions, type CleanupRequest, type CleanupSnapshot } from "./cleanupCore";

const cloud = () => !usesServerBackend() && (getAppMode() === "ONLINE" || (getAppMode() === "AUTO" && isSupabaseConfigured && navigator.onLine));
function assertAdmin(profile: AccessProfile) { if (profile.role !== "super_admin") throw new Error("Only Super Admin can manage data cleanup."); }
function snapshot(): CleanupSnapshot {
  return { employees: JSON.parse(localStorage.getItem("coop_sys_employees") || "[]"), members: JSON.parse(localStorage.getItem("coop_sys_members") || "[]"), ledger: JSON.parse(localStorage.getItem("coop_sys_payment_ledger") || "{}") };
}
export async function getCleanupPage(profile: AccessProfile, options: CleanupListOptions): Promise<{ items: CleanupListItem[]; total: number }> {
  assertAdmin(profile);
  if (usesServerBackend()) return serverRequest(`/maintenance/people?${new URLSearchParams({ kind: options.kind, search: options.search || "", state: options.state || "active", unassigned: String(Boolean(options.unassigned)), offset: String(options.offset || 0), limit: String(options.limit || 25) })}`);
  if (cloud()) {
    if (!supabase) throw new Error("Supabase is not configured.");
    const { data, error } = await supabase.rpc("maintenance_people_page", { p_kind: options.kind, p_search: options.search || "", p_state: options.state || "active", p_unassigned: Boolean(options.unassigned), p_offset: options.offset || 0, p_limit: options.limit || 25 });
    if (error) throw new Error(error.code === "PGRST202" ? "Cloud data maintenance is not initialized. Apply migration 0025_super_admin_data_cleanup.sql, then reload." : error.message);
    return data;
  }
  return listCleanupRecords(snapshot(), options);
}
export async function executeCleanup(profile: AccessProfile, input: CleanupRequest): Promise<{ employees: number; members: number; payments: number }> {
  assertAdmin(profile);
  if (usesServerBackend()) {
    await flushDatabaseStorage();
    const result = await serverRequest<{ employees: number; members: number; payments: number }>("/maintenance/people", { method: "POST", body: JSON.stringify(input) });
    await hydrateDatabaseStorage();
    return result;
  }
  if (cloud()) {
    if (!supabase) throw new Error("Supabase is not configured.");
    const { data, error } = await supabase.rpc("maintenance_cleanup_people", { p_kind: input.kind, p_action: input.action, p_target: input.target, p_ids: input.ids, p_confirmation: input.confirmation });
    if (error) throw new Error(error.code === "PGRST202" ? "Cloud data maintenance is not initialized. Apply migration 0025_super_admin_data_cleanup.sql, then reload." : error.message);
    return data;
  }
  await new Promise((resolve) => window.setTimeout(resolve, 25));
  const timestamp = new Date().toISOString();
  const cleaned = applyCleanup(snapshot(), input, timestamp);
  const writes: Record<string, string> = {
    coop_sys_employees: JSON.stringify(cleaned.snapshot.employees), coop_sys_members: JSON.stringify(cleaned.snapshot.members), coop_sys_payment_ledger: JSON.stringify(cleaned.snapshot.ledger),
    coop_sys_maintenance_history: JSON.stringify([...(JSON.parse(localStorage.getItem("coop_sys_maintenance_history") || "[]") as unknown[]), { actorId: profile.userId, timestamp, action: input.action, kind: input.kind, target: input.target, ...cleaned.result }].slice(-100)),
  };
  if (input.action !== "soft") {
    const users = JSON.parse(localStorage.getItem("coop_sys_user_access") || "[]") as Array<{ linked_employee_id?: string | null }>;
    writes.coop_sys_user_access = JSON.stringify(users.map((user) => cleaned.employeeIds.includes(user.linked_employee_id || "") ? { ...user, linked_employee_id: null } : user));
  }
  // Restore the prior snapshot if browser storage quota prevents a complete write.
  const previous = Object.fromEntries(Object.keys(writes).map((key) => [key, localStorage.getItem(key)]));
  try { Object.entries(writes).forEach(([key, value]) => localStorage.setItem(key, value)); }
  catch (error) { Object.entries(previous).forEach(([key, value]) => value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value)); throw error; }
  return cleaned.result;
}
