import type { Metadata } from "next";
import { supabaseConfigured } from "@/lib/supabase/env";
import { GosAvatar, ReactorLandscape } from "@/components/dashboard/illustrations";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Masuk — Konsol LacS·GOS" };

/** Only same-site relative paths are allowed as a post-login target (no open redirects). */
function safeNext(next: string | undefined) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="mx-auto grid min-h-screen max-w-[1100px] items-center gap-6 p-4 md:grid-cols-[1fr_440px] md:p-8">
      <section className="sky relative hidden h-[620px] flex-col overflow-hidden rounded-[32px] md:flex">
        <div className="relative z-10 p-10">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-white/70 p-1"><GosAvatar className="size-12" /></div>
            <div>
              <div className="text-sm font-extrabold tracking-[0.14em] text-ink">LacS·GOS</div>
              <div className="text-xs font-medium text-[#24406b]">GenoHack 2026 · SoluSEA Venture Lab</div>
            </div>
          </div>
          <h1 className="mt-10 max-w-sm text-[32px] font-extrabold leading-tight tracking-tight text-ink">
            Panen GOS di jam yang tepat.
          </h1>
          <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-[#24406b]">
            Konsol keputusan proses untuk produksi prebiotik GOS dengan enzim termostabil LacS F441Y.
          </p>
        </div>
        <ReactorLandscape className="mt-auto w-full" />
      </section>

      <section className="panel p-8">
        <div className="md:hidden">
          <GosAvatar className="size-12" />
        </div>
        <h2 className="mt-4 text-[24px] font-extrabold tracking-tight text-ink md:mt-0">Masuk</h2>
        <p className="mt-1 text-[13px] text-muted">Akses khusus pelanggan paket B2B. Gunakan email dan kata sandi dari tim kami.</p>
        <LoginForm next={safeNext(next)} configured={supabaseConfigured} />
      </section>
    </main>
  );
}
