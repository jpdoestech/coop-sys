import { isSupabaseConfigured } from "../../database/supabase/client";
import { getAppMode } from "../../utils/env";
import type { AccessProfile } from "../access/accessControl";
import { LocalAttendanceRepository } from "./local/LocalAttendanceRepository";
import { SupabaseAttendanceRepository } from "./supabase/SupabaseAttendanceRepository";
export function createAttendanceRepository(profile: AccessProfile) {
  const mode = getAppMode();
  return mode === "ONLINE" || mode === "AUTO" && isSupabaseConfigured && navigator.onLine ? new SupabaseAttendanceRepository(profile) : new LocalAttendanceRepository(profile);
}
