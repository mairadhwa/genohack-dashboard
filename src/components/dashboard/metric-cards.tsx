"use client";

import type { PeakSummary } from "@/lib/kinetics";
import { AnimatedNumber } from "@/components/ui/primitives";
import { cn, fmt } from "@/lib/utils";
import { Beaker, Clock3, Gauge, Zap } from "lucide-react";

/** Model optimum from hasil/puncak_dan_rugi_telat_F441Y.csv. */
const OPT = { yield: 63.02, time: 23.42 };

function Delta({ v, unit, better }: { v: number; unit: string; better: "up" | "down" }) {
  if (Math.abs(v) < 0.05) return <span className="text-[11px] font-semibold text-ok">sudah optimum</span>;
  const good = better === "up" ? v > 0 : v < 0;
  return (
    <span className={cn("num text-[11px] font-semibold", good ? "text-ok" : "text-warn")}>
      {v > 0 ? "+" : "−"}
      {fmt(Math.abs(v), 1)}
      {unit}
    </span>
  );
}

/** "Batch at a glance": four live metrics as a list (values spring-interpolate). */
export function MetricList({ s, volumeL }: { s: PeakSummary; volumeL: number }) {
  const items = [
    { icon: Gauge, tint: "bg-primary-soft text-primary", label: "Rendemen puncak", value: s.peak_yield_pct, digits: 1, unit: "% b/b", sub: `${fmt(s.peak_gos_g_L, 0)} g GOS/L`, delta: <Delta v={s.peak_yield_pct - OPT.yield} unit=" poin" better="up" /> },
    { icon: Clock3, tint: "bg-[#fff1dc] text-warn", label: "Waktu panen optimal", value: s.peak_time_h, digits: 1, unit: "jam", sub: `${fmt(s.conversion_at_peak_pct, 0)}% laktosa terkonversi`, delta: <Delta v={s.peak_time_h - OPT.time} unit=" jam" better="down" /> },
    { icon: Beaker, tint: "bg-[#e3f7ef] text-ok", label: "GOS saat panen", value: s.peak_gos_g_L, digits: 0, unit: "g/L", sub: `${fmt((s.peak_gos_g_L * volumeL) / 1000, 0)} kg per batch ${fmt(volumeL, 0)} L`, delta: <span className="num text-[11px] font-semibold text-muted">{fmt(s.productivity_g_L_h, 1)} g/L·h</span> },
    { icon: Zap, tint: "bg-[#efeaff] text-indigo", label: "Sisa enzim aktif", value: s.enzyme_remaining_pct, digits: 0, unit: "%", sub: "setelah peluruhan termal", delta: <span className={cn("text-[11px] font-semibold", s.enzyme_remaining_pct < 40 ? "text-warn" : "text-muted")}>{s.enzyme_remaining_pct < 40 ? "sulit dipakai ulang" : "bisa dipakai ulang"}</span> },
  ];

  return (
    <section className="panel flex flex-col p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-bold text-ink">Ringkasan batch</h3>
        <span className="text-xs font-semibold text-muted">vs optimum</span>
      </div>
      <ul className="mt-3 flex flex-1 flex-col justify-between divide-y divide-line">
        {items.map((m) => (
          <li key={m.label} className="flex items-center gap-3 py-3 first:pt-1 last:pb-0">
            <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", m.tint)}>
              <m.icon className="size-4.5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-muted">{m.label}</div>
              <div className="flex items-baseline gap-1">
                <AnimatedNumber value={m.value} digits={m.digits} className="text-[20px] font-extrabold leading-tight text-ink" />
                <span className="text-xs text-muted">{m.unit}</span>
              </div>
            </div>
            <div className="text-right">
              {m.delta}
              <div className="max-w-[120px] truncate text-[11px] text-muted">{m.sub}</div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
