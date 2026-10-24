import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./env";

/**
 * Service-role client. Bypasses RLS — server-only, and used ONLY to read the
 * hidden grid_combinations table. Never import this from a client component.
 */
let cached: SupabaseClient | null | undefined;

export function getAdminClient(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  cached = SUPABASE_URL && key ? createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
  return cached;
}
