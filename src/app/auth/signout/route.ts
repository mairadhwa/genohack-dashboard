import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";

/** POST /auth/signout — ends the session and returns to the login page. */
export async function POST(req: Request) {
  const db = await getServerClient();
  await db?.auth.signOut();
  return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
}
