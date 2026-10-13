import { isSupabaseConfigured } from "../../database/supabase/client";
import { getAppMode } from "../../utils/env";
import type { AccessProfile } from "../access/accessControl";
import { LocalPayrollRunRepository } from "./local/LocalPayrollRunRepository";
import { SupabasePayrollRunRepository } from "./supabase/SupabasePayrollRunRepository";
export function createPayrollRunRepository(profile: AccessProfile) {
  const mode = getAppMode();
  return mode === "ONLINE" || mode === "AUTO" && isSupabaseConfigured && navigator.onLine ? new SupabasePayrollRunRepository(profile) : new LocalPayrollRunRepository(profile);
}
