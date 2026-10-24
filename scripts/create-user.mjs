/**
 * Create a customer account (sign-up is disabled for the paid B2B package).
 *
 *   npm run create-user -- <email> <password> ["Full Name"] ["Company"]
 *
 * Uses SUPABASE_SERVICE_ROLE_KEY from .env.local. The profile row (with
 * is_active = true) is created automatically by the database trigger.
 * To revoke access later: set profiles.is_active = false in Supabase.
 */
import { createClient } from "@supabase/supabase-js";

const [email, password, fullName, company] = process.argv.slice(2);
if (!email || !password) {
  console.error('Usage: npm run create-user -- <email> <password> ["Full Name"] ["Company"]');
  process.exit(1);
}
if (password.length < 8) {
  console.error("Password must be at least 8 characters.");
  process.exit(1);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data, error } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: fullName ?? null, company: company ?? null },
});
if (error) {
  console.error(`Could not create user: ${error.message}`);
  process.exit(1);
}
console.log(`Created ${data.user.email} (id ${data.user.id}). They can sign in now.`);
