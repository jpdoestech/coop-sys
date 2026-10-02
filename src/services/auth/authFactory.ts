import { isSupabaseConfigured } from "../../database/supabase/client";
import { getAppMode } from "../../utils/env";
import type { AuthService } from "./types";
import { LocalAuthService } from "./local/LocalAuthService";
import { SupabaseAuthService } from "./supabase/SupabaseAuthService";
import { usesServerBackend } from "../server/serverApi";
import { ServerAuthService } from "./server/ServerAuthService";

export function createAuthService(): AuthService {
  if (usesServerBackend()) return new ServerAuthService();
  const mode = getAppMode();
  if (mode === "ONLINE" || (mode === "AUTO" && isSupabaseConfigured && navigator.onLine)) return new SupabaseAuthService();
  return new LocalAuthService();
}
