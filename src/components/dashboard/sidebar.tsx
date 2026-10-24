"use client";

import { motion } from "motion/react";
import { BookOpenCheck, Database, FileSpreadsheet, FlaskConical, LogOut, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type View = "sim" | "csv";

const ITEMS: { value: View; label: string; short: string; icon: LucideIcon }[] = [
  { value: "sim", label: "Simulasi", short: "Simulasi", icon: FlaskConical },
  { value: "csv", label: "Analisis CSV", short: "CSV", icon: FileSpreadsheet },
];

function NavButton({ active, label, icon: Icon, onClick, layout }: { active?: boolean; label: string; icon: LucideIcon; onClick: () => void; layout: "rail" | "bar" }) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      title={label}
      className={cn(
        "group relative flex cursor-pointer items-center justify-center rounded-2xl transition-colors duration-150 active:scale-95",
        layout === "rail" ? "size-11" : "h-12 flex-1 flex-col gap-0.5",
        active ? "text-white" : "text-muted hover:bg-primary-soft hover:text-primary",
      )}
    >
      {active && (
        <motion.span
          layoutId={`nav-${layout}`}
          className="absolute inset-0 rounded-2xl bg-primary shadow-[0_10px_20px_-8px_rgb(37_99_235/0.7)]"
          transition={{ type: "spring", stiffness: 500, damping: 38 }}
        />
      )}
      <Icon className="relative size-5" aria-hidden />
      <span className={layout === "rail" ? "sr-only" : "relative text-[10px] font-semibold"}>{label}</span>
      {active && layout === "rail" && <span className="absolute -right-3 size-1.5 rounded-full bg-primary" aria-hidden />}
    </button>
  );
}

/** Sign-out is a plain POST form so it works even if JavaScript fails. */
function SignOut({ layout }: { layout: "rail" | "bar" }) {
  return (
    <form action="/auth/signout" method="post" className={layout === "bar" ? "flex flex-1" : undefined}>
      <button
        type="submit"
        title="Keluar"
        className={cn(
          "flex cursor-pointer items-center justify-center rounded-2xl text-muted transition-colors duration-150 hover:bg-bad/10 hover:text-bad active:scale-95",
          layout === "rail" ? "size-11" : "h-12 flex-1 flex-col gap-0.5",
        )}
      >
        <LogOut className="size-5" aria-hidden />
        <span className={layout === "rail" ? "sr-only" : "text-[10px] font-semibold"}>Keluar</span>
      </button>
    </form>
  );
}

export interface SidebarUser {
  email: string;
  name: string | null;
  company: string | null;
}

/** Left icon rail on desktop, bottom tab bar on phones. */
export function Sidebar({ view, onView, onProvenance, db, user }: { view: View; onView: (v: View) => void; onProvenance: () => void; db: boolean | null; user: SidebarUser }) {
  const who = user.name ?? user.email;
  const initial = (who.trim()[0] ?? "?").toUpperCase();
  return (
    <>
      <nav aria-label="Ruang kerja" className="sticky top-4 hidden h-[calc(100vh-32px)] w-[76px] shrink-0 flex-col items-center py-6 lg:flex">
        <div className="flex flex-col items-center">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-primary text-white shadow-[0_10px_20px_-8px_rgb(37_99_235/0.7)]">
            <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
              <path d="M3 18 L9 9 L13 14 L16 10 L21 18 Z" fill="currentColor" />
              <circle cx="17" cy="6" r="2" fill="currentColor" />
            </svg>
          </div>
          <span className="mt-1.5 text-[9px] font-extrabold tracking-[0.18em] text-ink">GOS</span>
        </div>

        <div className="mt-12 flex flex-col gap-3">
          {ITEMS.map((i) => (
            <NavButton key={i.value} layout="rail" active={view === i.value} label={i.label} icon={i.icon} onClick={() => onView(i.value)} />
          ))}
          <NavButton layout="rail" label="Asal-usul model" icon={BookOpenCheck} onClick={onProvenance} />
        </div>

        <div className="mt-auto flex flex-col items-center gap-3">
          <span
            className={cn("relative flex size-11 items-center justify-center rounded-2xl", db ? "bg-ok/10 text-ok" : "bg-subtle text-muted")}
            title={db ? "Unggahan disimpan ke riwayat akun Anda" : "Penyimpanan belum aktif"}
          >
            <Database className="size-5" aria-hidden />
            <span className={cn("absolute right-2 top-2 size-2 rounded-full ring-2 ring-white", db ? "bg-ok" : "bg-muted")} />
            <span className="sr-only">{db ? "Penyimpanan aktif" : "Penyimpanan belum aktif"}</span>
          </span>
          <span
            className="flex size-11 items-center justify-center rounded-full bg-primary-soft text-[15px] font-extrabold text-primary"
            title={`${who}${user.company ? " · " + user.company : ""}`}
            aria-label={`Masuk sebagai ${who}`}
          >
            {initial}
          </span>
          <SignOut layout="rail" />
        </div>
      </nav>

      <nav aria-label="Ruang kerja" className="fixed inset-x-3 bottom-3 z-40 flex gap-1 rounded-[22px] bg-surface/95 p-1.5 shadow-[0_10px_40px_-10px_rgb(27_37_65/0.35)] backdrop-blur lg:hidden">
        {ITEMS.map((i) => (
          <NavButton key={i.value} layout="bar" active={view === i.value} label={i.short} icon={i.icon} onClick={() => onView(i.value)} />
        ))}
        <NavButton layout="bar" label="Asal model" icon={BookOpenCheck} onClick={onProvenance} />
        <SignOut layout="bar" />
      </nav>
    </>
  );
}
