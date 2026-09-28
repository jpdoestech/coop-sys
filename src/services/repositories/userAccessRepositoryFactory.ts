import { isSupabaseConfigured } from "../../database/supabase/client";
import { getAppMode } from "../../utils/env";
import type { UserAccessRepository } from "./UserAccessRepository";
import { LocalUserAccessRepository } from "./local/LocalUserAccessRepository";
import { SupabaseUserAccessRepository } from "./supabase/SupabaseUserAccessRepository";

export function createUserAccessRepository(): UserAccessRepository {
  const mode = getAppMode();
  if (mode === "ONLINE" || (mode === "AUTO" && isSupabaseConfigured && navigator.onLine)) return new SupabaseUserAccessRepository();
  return new LocalUserAccessRepository();
}
