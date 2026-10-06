import { isSupabaseConfigured } from "../../database/supabase/client";
import { getAppMode } from "../../utils/env";
import { usesServerBackend } from "../server/serverApi";
import { LocalReportRepository } from "./local/LocalReportRepository";
import { ServerReportRepository } from "./server/ServerReportRepository";
import { SupabaseReportRepository } from "./supabase/SupabaseReportRepository";
import type { ReportRepository } from "./ReportRepository";

export function createReportRepository(): ReportRepository {
  if (usesServerBackend()) return new ServerReportRepository();
  const mode = getAppMode();
  if (mode === "ONLINE" || (mode === "AUTO" && isSupabaseConfigured && navigator.onLine)) return new SupabaseReportRepository();
  return new LocalReportRepository();
}
