import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabasePublicKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

function isHttpUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch { return false; }
}

function isServiceRoleKey(key: string | undefined) {
  if (!key) return false;
  if (key.startsWith("sb_secret_")) return true;
  try {
    const segment = key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(segment.padEnd(Math.ceil(segment.length / 4) * 4, "="))) as { role?: string };
    return payload.role === "service_role";
  } catch { return false; }
}

if (isServiceRoleKey(supabasePublicKey)) throw new Error("A Supabase service-role/secret key must never be exposed in the browser. Configure VITE_SUPABASE_ANON_KEY or VITE_SUPABASE_PUBLISHABLE_KEY.");

// Offline EXE builds use a non-HTTP sentinel to avoid embedding cloud credentials.
export const isSupabaseConfigured = isHttpUrl(supabaseUrl) && Boolean(supabasePublicKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabasePublicKey!)
  : null;
