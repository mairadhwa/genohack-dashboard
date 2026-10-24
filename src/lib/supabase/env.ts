/**
 * Public Supabase settings (safe to expose: the anon key is protected by RLS).
 * Must be referenced as literal process.env.NEXT_PUBLIC_* so Next.js inlines them.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** False until .env.local / Vercel env vars are filled in. */
export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
