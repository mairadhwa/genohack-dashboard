"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import { Check, Clock3, Droplets, Thermometer } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { predict, type Conditions } from "@/lib/kinetics";
import { cn, fmt } from "@/lib/utils";
import { ConditionThumb } from "./illustrations";

const same = (a: Conditions, b: Conditions) => (Object.keys(a) as (keyof Conditions)[]).every((k) => Math.abs(a[k] - b[k]) < 1e-9);

/**
 * Curated conditions. "Fastest in window" is the highest-productivity point of
 * the grid search inside the operating window (500 g/L · 85 °C · pH 6.0,
 * 22.8 g/L·h). It is hardcoded so the grid itself never ships to the browser.
 */
const RECS: { title: string; why: string; c: Conditions }[] = [
  { title: "Optimum model", why: "Rendemen tertinggi di grid", c: { lactose_g_L: 800, temperature_C: 85, pH: 6.0, enzyme_U_mL: 9 } },
  { title: "Tercepat di jendela", why: "GOS terbanyak per jam reaktor", c: { lactose_g_L: 500, temperature_C: 85, pH: 6.0, enzyme_U_mL: 9 } },
  { title: "Acuan Sun dkk. 2014", why: "Kondisi terukur & terbit", c: { lactose_g_L: 700, temperature_C: 75, pH: 6.0, enzyme_U_mL: 9 } },
  { title: "Start-up ringan", why: "Beban terendah di jendela", c: { lactose_g_L: 500, temperature_C: 70, pH: 6.0, enzyme_U_mL: 9 } },
];

export function Recommendations({ current, onLoad }: { current: Conditions; onLoad: (c: Conditions) => void }) {
  const rows = useMemo(() => RECS.map((r) => ({ ...r, s: predict(r.c).summary })), []);

  return (
    <section className="panel p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-bold text-ink">Kondisi yang disarankan</h3>
        <span className="text-xs font-semibold text-muted">F441Y · 9 U/mL</span>
      </div>
      <ul className="mt-3 space-y-1">
        {rows.map((r) => {
          const active = same(r.c, current);
          return (
            <li key={r.title} className="relative">
              {active && (
                <motion.span
                  layoutId="rec-active"
                  className="absolute inset-0 rounded-2xl bg-surface shadow-[0_10px_30px_-12px_rgb(37_99_235/0.45)] ring-1 ring-line"
                  transition={{ type: "spring", stiffness: 420, damping: 36 }}
                />
              )}
              <div className="relative flex items-center gap-3 rounded-2xl px-2 py-2.5">
                <ConditionThumb temperature={r.c.temperature_C} lactose={r.c.lactose_g_L} className="size-12 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-bold text-ink">{r.title}</div>
                  <div className="num mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted">
                    <span className="flex items-center gap-1"><Thermometer className="size-3 text-primary" aria-hidden />{r.c.temperature_C} °C</span>
                    <span className="flex items-center gap-1"><Droplets className="size-3 text-primary" aria-hidden />pH {fmt(r.c.pH, 1)}</span>
                    <span>{r.c.lactose_g_L} g/L</span>
                    <span className="hidden items-center gap-1 sm:flex"><Clock3 className="size-3 text-primary" aria-hidden />{fmt(r.s.peak_time_h, 1)} h</span>
                  </div>
                </div>
                <div className="hidden text-right sm:block">
                  <div className="num text-[15px] font-extrabold text-ink">{fmt(r.s.peak_yield_pct, 1)}%</div>
                  <div className="text-[11px] text-muted">{r.why}</div>
                </div>
                <Button
                  size="sm"
                  variant={active ? "primary" : "soft"}
                  className={cn("min-w-[84px]")}
                  aria-pressed={active}
                  onClick={() => onLoad(r.c)}
                >
                  {active ? <><Check /> Dipakai</> : "Pakai"}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
