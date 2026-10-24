"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BookMarked, ChevronRight, CircleAlert, CircleCheck, CircleDot, Download, FlaskConical, Microscope, Package } from "lucide-react";
import { Badge, Button, Segmented, fadeUp } from "@/components/ui/primitives";
import { PROTOCOL, STATUS_LABEL, type ProtocolStatus } from "@/data/protocol";
import { downloadText } from "@/lib/export";
import { cn } from "@/lib/utils";

const PART_ICON = { A: Microscope, B: FlaskConical, C: Package } as const;

const STATUS_STYLE: Record<ProtocolStatus, { tone: "ok" | "primary" | "warn"; icon: typeof CircleCheck }> = {
  terbukti: { tone: "ok", icon: CircleCheck },
  rencana: { tone: "primary", icon: CircleDot },
  terbuka: { tone: "warn", icon: CircleAlert },
};

/** Markdown export, supaya protokol bisa ditempel ke laporan atau dibagikan. */
function toMarkdown() {
  const lines = ["# Protokol penelitian — GOS dengan LacS F441Y", ""];
  for (const part of PROTOCOL) {
    lines.push(`## Bagian ${part.letter}: ${part.title}`, `_${part.subtitle}_`, "");
    for (const s of part.steps) {
      lines.push(`### ${s.no}. ${s.title}  (${STATUS_LABEL[s.status]})`, s.body);
      if (s.facts?.length) lines.push("", ...s.facts.map((f) => `- **${f.label}:** ${f.value}`));
      if (s.note) lines.push("", `> ${s.note}`);
      if (s.source) lines.push("", `Sumber: ${s.source}`);
      lines.push("");
    }
  }
  return lines.join("\n");
}

function StepCard({ step, open, onToggle }: { step: (typeof PROTOCOL)[number]["steps"][number]; open: boolean; onToggle: () => void }) {
  const { tone, icon: Icon } = STATUS_STYLE[step.status];
  const hasDetail = Boolean(step.facts?.length || step.note || step.source);

  return (
    <li className="relative pl-12">
      {/* garis waktu + nomor langkah */}
      <span className="absolute left-0 top-0 flex size-9 items-center justify-center rounded-full bg-primary-soft text-[13px] font-extrabold text-primary ring-4 ring-surface">
        {step.no}
      </span>

      <div className={cn("rounded-2xl border p-4 transition-colors", open ? "border-primary/30 bg-primary-soft/40" : "border-line bg-surface hover:border-line-strong")}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h4 className="text-[14px] font-bold text-ink">{step.title}</h4>
          <Badge tone={tone}>
            <Icon className="size-3" aria-hidden /> {STATUS_LABEL[step.status]}
          </Badge>
        </div>
        <p className="mt-1.5 text-[13px] leading-relaxed text-body">{step.body}</p>

        {hasDetail && (
          <button
            onClick={onToggle}
            aria-expanded={open}
            className="mt-2 flex cursor-pointer items-center gap-1 text-[12px] font-semibold text-primary transition-colors hover:text-primary-600"
          >
            <ChevronRight className={cn("size-3.5 transition-transform duration-200", open && "rotate-90")} aria-hidden />
            {open ? "Sembunyikan detail" : "Lihat detail"}
          </button>
        )}

        <AnimatePresence initial={false}>
          {open && hasDetail && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto", transition: { duration: 0.22 } }}
              exit={{ opacity: 0, height: 0, transition: { duration: 0.15 } }}
              className="overflow-hidden"
            >
              <div className="mt-3 space-y-3">
                {step.facts?.length ? (
                  <dl className="grid gap-2 sm:grid-cols-2">
                    {step.facts.map((f) => (
                      <div key={f.label} className="rounded-xl bg-subtle px-3 py-2">
                        <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">{f.label}</dt>
                        <dd className="num mt-0.5 text-[13px] font-bold text-ink">{f.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
                {step.note && (
                  <p className="rounded-xl border-l-[3px] border-warn bg-warn/5 px-3 py-2 text-[12px] leading-relaxed text-body">{step.note}</p>
                )}
                {step.source && <p className="text-[11px] font-medium text-muted">Sumber: {step.source}</p>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </li>
  );
}

export function Protocol() {
  const [part, setPart] = useState<string>(PROTOCOL[0].id);
  const [open, setOpen] = useState<number | null>(null);

  const active = PROTOCOL.find((p) => p.id === part)!;
  const counts = useMemo(() => {
    const all = PROTOCOL.flatMap((p) => p.steps);
    return {
      total: all.length,
      terbukti: all.filter((s) => s.status === "terbukti").length,
      terbuka: all.filter((s) => s.status === "terbuka").length,
    };
  }, []);

  const Icon = PART_ICON[active.letter];

  return (
    <div className="grid gap-5">
      {/* ringkasan */}
      <div className="panel grid gap-px overflow-hidden bg-line! sm:grid-cols-3">
        {[
          { k: "Total langkah", v: String(counts.total), d: "dari gen sampai produk" },
          { k: "Ada acuan terbitan", v: String(counts.terbukti), d: "angkanya dari Sun dkk. 2014" },
          { k: "Perlu diputuskan", v: String(counts.terbuka), d: "belum diuji atau belum ditetapkan" },
        ].map((m) => (
          <div key={m.k} className="bg-surface px-5 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{m.k}</div>
            <div className="num mt-1 text-[26px] font-extrabold leading-none text-ink">{m.v}</div>
            <div className="mt-1 text-[12px] text-muted">{m.d}</div>
          </div>
        ))}
      </div>

      <section className="panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary-soft">
              <Icon className="size-5 text-primary" aria-hidden />
            </span>
            <div>
              <h3 className="text-[15px] font-bold text-ink">
                Bagian {active.letter} · {active.title}
              </h3>
              <p className="text-xs text-muted">{active.subtitle}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              id="protocol-part"
              size="sm"
              value={part}
              onChange={(v) => {
                setPart(v);
                setOpen(null);
              }}
              options={PROTOCOL.map((p) => ({ value: p.id, label: p.letter }))}
            />
            <Button size="sm" variant="ghost" onClick={() => downloadText("protokol_gos_f441y.md", toMarkdown(), "text/markdown;charset=utf-8")}>
              <Download /> Unduh protokol
            </Button>
          </div>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.ol key={active.id} {...fadeUp} className="relative mt-5 space-y-3">
            {/* garis penghubung antar langkah */}
            <span className="absolute bottom-6 left-[17px] top-6 w-px bg-line" aria-hidden />
            {active.steps.map((s) => (
              <StepCard key={s.no} step={s} open={open === s.no} onToggle={() => setOpen(open === s.no ? null : s.no)} />
            ))}
          </motion.ol>
        </AnimatePresence>
      </section>

      <section className="panel flex flex-wrap items-center gap-3 p-5">
        <BookMarked className="size-4 shrink-0 text-primary" aria-hidden />
        <p className="flex-1 text-[13px] leading-relaxed text-muted">
          Bagian B (langkah 11–14) adalah bagian yang disimulasikan dashboard ini. Hasil HPLC dari langkah 14 bisa diisikan ke kolom{" "}
          <code className="rounded bg-subtle px-1 text-ink">observed_yield_pct</code> saat mengunggah CSV, supaya akurasi model terlacak.
        </p>
      </section>
    </div>
  );
}
