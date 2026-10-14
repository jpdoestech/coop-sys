import { supabase, isSupabaseConfigured } from "../../database/supabase/client";
import { getAppMode } from "../../utils/env";
import { assertPermission, type AccessProfile } from "../access/accessControl";
import { serverRequest, usesServerBackend } from "../server/serverApi";
export type AttendanceBlankMode = "present" | "absent";
export type AttendancePreferences = { blank_mode: AttendanceBlankMode };
export function validateAttendancePreferences(value: AttendancePreferences) {
  if (!value || !["present", "absent"].includes(value.blank_mode)) throw new Error("Select present-default or absent-default attendance.");
}
function online() { const mode = getAppMode(); return mode === "ONLINE" || mode === "AUTO" && isSupabaseConfigured && navigator.onLine; }
export async function loadAttendancePreferences(profile: AccessProfile): Promise<AttendancePreferences> {
  assertPermission(profile, "payroll.view");
  if (usesServerBackend()) return serverRequest("/attendance/preferences");
  if (online()) {
    if (!supabase) throw new Error("Supabase is not configured.");
    const { data, error } = await supabase.from("attendance_preferences").select("blank_mode").eq("user_id", profile.userId).maybeSingle();
    if (error) throw new Error(error.message);
    return data || { blank_mode: "present" };
  }
  const value = JSON.parse(localStorage.getItem(`coop_sys_attendance_preferences:${profile.userId}`) || '{"blank_mode":"present"}');
  validateAttendancePreferences(value); return value;
}
export async function saveAttendancePreferences(profile: AccessProfile, value: AttendancePreferences) {
  assertPermission(profile, "payroll.view"); validateAttendancePreferences(value);
  if (usesServerBackend()) return serverRequest<void>("/attendance/preferences", { method: "PUT", body: JSON.stringify(value) });
  if (online()) {
    if (!supabase) throw new Error("Supabase is not configured.");
    const { error } = await supabase.from("attendance_preferences").upsert({ user_id: profile.userId, blank_mode: value.blank_mode });
    if (error) throw new Error(error.message); return;
  }
  localStorage.setItem(`coop_sys_attendance_preferences:${profile.userId}`, JSON.stringify(value));
}
