import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublicKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

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

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublicKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublicKey)
  : null;
