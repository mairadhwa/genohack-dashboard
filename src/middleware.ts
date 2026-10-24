import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigured } from "@/lib/supabase/env";

/**
 * Access gate for the whole app (paid B2B package — no public pages).
 *
 *  - Refreshes the Supabase session cookie on every request.
 *  - Signed out + page request → redirect to /login?next=<path>.
 *  - Signed out + /api request  → 401 JSON.
 *  - Signed in + /login         → redirect to the dashboard.
 *  - Supabase not configured    → nothing is reachable except /login,
 *    which explains what is missing.
 */
const PUBLIC_PATHS = ["/login", "/auth/"];

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(p));
  const isApi = path.startsWith("/api/");

  if (!supabaseConfigured) {
    if (isPublic) return NextResponse.next();
    if (isApi) return NextResponse.json({ error: "Supabase belum dikonfigurasi" }, { status: 503 });
    return NextResponse.redirect(new URL("/login", req.url));
  }

  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });

  // getUser() validates the token with Supabase; never trust the cookie alone.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublic) {
    if (isApi) return NextResponse.json({ error: "Silakan masuk terlebih dahulu" }, { status: 401 });
    const url = new URL("/login", req.url);
    if (path !== "/") url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (user && path === "/login") return NextResponse.redirect(new URL("/", req.url));

  return res;
}

export const config = {
  // Everything except Next.js internals and static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
