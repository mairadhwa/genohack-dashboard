import { redirect } from "next/navigation";
import { Dashboard } from "@/components/dashboard/dashboard";
import { getCurrentUser } from "@/lib/supabase/server";

/** Always render per request: the page depends on the signed-in user. */
export const dynamic = "force-dynamic";

/**
 * Protected dashboard. The middleware already redirects signed-out visitors;
 * this server-side check is a second line of defence, plus the paid-plan gate
 * (profiles.is_active, managed by an admin in Supabase).
 */
export default async function Page() {
  const { db, user } = await getCurrentUser();
  if (!db || !user) redirect("/login");

  const { data: profile } = await db.from("profiles").select("full_name, company, is_active").eq("id", user.id).maybeSingle();

  if (profile && profile.is_active === false) {
    return (
      <main className="grid min-h-screen place-items-center p-6">
        <div className="panel max-w-md p-8 text-center">
          <h1 className="text-xl font-extrabold text-ink">Akun belum aktif</h1>
          <p className="mt-2 text-[13px] text-muted">
            Paket untuk akun <span className="font-semibold text-body">{user.email}</span> belum aktif atau sudah berakhir. Hubungi tim GenoHack untuk
            mengaktifkan kembali.
          </p>
          <form action="/auth/signout" method="post" className="mt-5">
            <button className="cursor-pointer rounded-full bg-primary px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-primary-600">Keluar</button>
          </form>
        </div>
      </main>
    );
  }

  return <Dashboard user={{ email: user.email ?? "", name: profile?.full_name ?? null, company: profile?.company ?? null }} />;
}
