import { isSupabaseConfigured } from "../../database/supabase/client";
import { getAppMode } from "../../utils/env";
import type { OrganizationDirectoryRepository } from "./OrganizationDirectoryRepository";
import { LocalOrganizationDirectoryRepository } from "./local/LocalOrganizationDirectoryRepository";
import { SupabaseOrganizationDirectoryRepository } from "./supabase/SupabaseOrganizationDirectoryRepository";

export function createOrganizationDirectoryRepository(): OrganizationDirectoryRepository {
  const mode = getAppMode();
  if (mode === "ONLINE" || (mode === "AUTO" && isSupabaseConfigured && navigator.onLine)) return new SupabaseOrganizationDirectoryRepository();
  return new LocalOrganizationDirectoryRepository();
}
