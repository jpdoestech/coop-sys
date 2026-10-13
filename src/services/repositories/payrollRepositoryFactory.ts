import { isSupabaseConfigured } from "../../database/supabase/client";
import { getAppMode } from "../../utils/env";
import type { AccessProfile } from "../access/accessControl";
import { LocalPayrollRepository } from "./local/LocalPayrollRepository";
import { SupabasePayrollRepository } from "./supabase/SupabasePayrollRepository";
export function createPayrollRepository(profile: AccessProfile) {
  const mode = getAppMode();
  return mode === "ONLINE" || mode === "AUTO" && isSupabaseConfigured && navigator.onLine ? new SupabasePayrollRepository(profile) : new LocalPayrollRepository(profile);
}
