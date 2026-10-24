"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { Button, Input, fadeUp } from "@/components/ui/primitives";
import { getBrowserClient } from "@/lib/supabase/browser";

/** Supabase error codes → plain Indonesian messages. */
function explain(message: string) {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Email atau kata sandi salah.";
  if (m.includes("email not confirmed")) return "Email belum dikonfirmasi. Cek kotak masuk Anda.";
  if (m.includes("rate limit") || m.includes("too many")) return "Terlalu banyak percobaan. Coba lagi beberapa menit lagi.";
  if (m.includes("fetch")) return "Tidak bisa terhubung ke server. Periksa koneksi internet.";
  return message;
}

export function LoginForm({ next, configured }: { next: string; configured: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!configured) {
    return (
      <div role="alert" className="mt-6 rounded-2xl border border-warn/30 bg-warn/10 p-4 text-[13px] text-body">
        <div className="flex items-center gap-2 font-bold text-warn">
          <AlertTriangle className="size-4" /> Supabase belum dikonfigurasi
        </div>
        <p className="mt-1.5">
          Isi <code className="rounded bg-white px-1">NEXT_PUBLIC_SUPABASE_URL</code> dan{" "}
          <code className="rounded bg-white px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> di <code className="rounded bg-white px-1">.env.local</code> (lokal) atau di
          Environment Variables Vercel, lalu jalankan ulang aplikasi.
        </p>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await getBrowserClient().auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setError(explain(error.message));
      setBusy(false);
      return;
    }
    router.replace(next);
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
      <div>
        <label htmlFor="email" className="mb-1.5 block text-[13px] font-semibold text-ink">Email</label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="nama@perusahaan.co.id"
          aria-invalid={Boolean(error)}
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1.5 block text-[13px] font-semibold text-ink">Kata sandi</label>
        <div className="relative">
          <Input
            id="password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pr-11"
            aria-invalid={Boolean(error)}
          />
          <button
            type="button"
            onClick={() => setShow(!show)}
            aria-label={show ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
            className="absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-muted transition-colors hover:bg-subtle hover:text-ink"
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {error && (
          <motion.p {...fadeUp} role="alert" className="flex items-start gap-2 rounded-xl bg-bad/10 px-3 py-2 text-[13px] font-medium text-bad">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {error}
          </motion.p>
        )}
      </AnimatePresence>

      <Button type="submit" variant="primary" className="w-full" disabled={busy || !email || !password}>
        {busy ? <Loader2 className="animate-spin" /> : <LogIn />} {busy ? "Memeriksa…" : "Masuk"}
      </Button>

      <p className="text-center text-xs text-muted">
        Belum punya akun atau lupa kata sandi? Hubungi tim GenoHack untuk aktivasi paket.
      </p>
    </form>
  );
}
