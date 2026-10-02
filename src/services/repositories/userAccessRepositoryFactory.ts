import { isSupabaseConfigured } from "../../database/supabase/client";
import { getAppMode } from "../../utils/env";
import type { UserAccessRepository } from "./UserAccessRepository";
import { LocalUserAccessRepository } from "./local/LocalUserAccessRepository";
import { SupabaseUserAccessRepository } from "./supabase/SupabaseUserAccessRepository";
import { usesServerBackend } from "../server/serverApi";
import { ServerUserAccessRepository } from "./server/ServerUserAccessRepository";

export function createUserAccessRepository(): UserAccessRepository {
  if (usesServerBackend()) return new ServerUserAccessRepository();
  const mode = getAppMode();
  if (mode === "ONLINE" || (mode === "AUTO" && isSupabaseConfigured && navigator.onLine)) return new SupabaseUserAccessRepository();
  return new LocalUserAccessRepository();
}
