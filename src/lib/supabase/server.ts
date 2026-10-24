import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigured } from "./env";

/**
 * Per-request client acting AS the signed-in user (anon key + session cookie).
 * Every query through it is subject to Row Level Security.
 */
export async function getServerClient() {
  if (!supabaseConfigured) return null;
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Called from a Server Component: cookies are read-only there.
          // The middleware refreshes the session, so this is safe to ignore.
        }
      },
    },
  });
}

/** The verified current user (validated with Supabase Auth, not just the cookie). */
export async function getCurrentUser() {
  const db = await getServerClient();
  if (!db) return { db: null, user: null };
  const { data } = await db.auth.getUser();
  return { db, user: data.user };
}
