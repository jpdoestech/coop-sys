import { isSupabaseConfigured } from "../../database/supabase/client";
import { getAppMode } from "../../utils/env";
import type { DashboardRepository } from "./DashboardRepository";
import { LocalDashboardRepository } from "./local/LocalDashboardRepository";
import { SupabaseDashboardRepository } from "./supabase/SupabaseDashboardRepository";

export function createDashboardRepository(): DashboardRepository {
  const mode = getAppMode();
  if (mode === "ONLINE" || (mode === "AUTO" && isSupabaseConfigured && navigator.onLine)) {
    return new SupabaseDashboardRepository();
  }
  return new LocalDashboardRepository();
}
