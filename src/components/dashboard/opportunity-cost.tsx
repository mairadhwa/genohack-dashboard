"use client";

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CircleDollarSign } from "lucide-react";
import { Badge, Panel } from "@/components/ui/primitives";
import type { PeakSummary } from "@/lib/kinetics";
import { cn, fmt, idr, idrJuta } from "@/lib/utils";
import { AXIS, ChartFrame } from "./charts";

export interface Economics {
  volume_L: number; // working volume of one reactor batch
  price_idr_kg: number; // B2B selling price of GOS
  turnaround_h: number; // cleaning, filling, heat-up between batches
  hours_per_year: number;
}

/** B2B defaults: Rp 80.000/kg GOS, standard 1.000 L industrial batch. */
export const DEFAULT_ECON: Economics = { volume_L: 1000, price_idr_kg: 80_000, turnaround_h: 6, hours_per_year: 8000 };

/**
 * A late harvest costs twice:
 *  1. degradation — GOS in the tank is hydrolysed back (fewer g/L per batch)
 *  2. capacity    — the reactor is occupied longer, so fewer batches per year
 */
export function delayCost(s: PeakSummary, e: Economics, delay: 6 | 12 | 24) {
  const L = e.volume_L;
  const kgOnTime = (s.peak_gos_g_L * L) / 1000;
  const kgLate = ((s.peak_gos_g_L - s.loss_g_L[delay]) * L) / 1000;
  const nOnTime = e.hours_per_year / (s.peak_time_h + e.turnaround_h);
  const nLate = e.hours_per_year / (s.peak_time_h + delay + e.turnaround_h);
  const degradation = nLate * (kgOnTime - kgLate) * e.price_idr_kg;
  const capacity = (nOnTime - nLate) * kgOnTime * e.price_idr_kg;
  return {
    delay,
    label: `+${delay} jam`,
    yield_pts: s.loss_pts[delay],
    kg_batch: kgOnTime - kgLate,
    idr_batch: (kgOnTime - kgLate) * e.price_idr_kg,
    degradation,
    capacity,
    total: degradation + capacity,
    batches_lost: nOnTime - nLate,
  };
}

const FIELDS: { key: keyof Economics; label: string; unit: string; step: number }[] = [
  { key: "volume_L", label: "Volume reaktor", unit: "L", step: 100 },
  { key: "price_idr_kg", label: "Harga GOS", unit: "Rp/kg", step: 1000 },
  { key: "turnaround_h", label: "Jeda antar-batch", unit: "jam", step: 1 },
  { key: "hours_per_year", label: "Waktu operasi", unit: "jam/thn", step: 100 },
];

const C_DEG = "#2563eb";

export function OpportunityCost({ s, econ, onEcon }: { s: PeakSummary; econ: Economics; onEcon: (e: Economics) => void }) {
  const rows = ([6, 12, 24] as const).map((d) => delayCost(s, econ, d));

  return (
    <Panel
      icon={CircleDollarSign}
      title="Matriks biaya peluang"
      subtitle="Nilai GOS yang hilang bila panen terlambat dan GOS di tangki terurai kembali. Semua asumsi bisa diubah."
      actions={<Badge tone="warn" className="num">Asumsi: {idr(econ.price_idr_kg)}/kg · {fmt(econ.volume_L, 0)} L per batch</Badge>}
      collapsible
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {FIELDS.map((f) => (
          <label key={f.key} className="block">
            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">{f.label}</span>
            <div className="mt-1 flex items-center rounded-lg border border-line-strong bg-surface pr-2.5 transition-colors focus-within:border-primary/60 hover:border-primary/30">
              <input
                type="number"
                step={f.step}
                min={0}
                value={econ[f.key]}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v) && v >= 0) onEcon({ ...econ, [f.key]: v });
                }}
                className="num h-9 w-full min-w-0 bg-transparent px-2.5 text-[13px] text-ink outline-none focus-visible:outline-none"
              />
              <span className="shrink-0 text-[11px] text-muted">{f.unit}</span>
            </div>
          </label>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div>
          {/* Headline: loss per 1.000 L batch from GOS degrading in the tank */}
          <ChartFrame name="kerugian_per_batch" title="Kerugian per batch akibat GOS terurai" height={240}>
            <ResponsiveContainer>
              <BarChart data={rows} margin={{ top: 28, right: 8, bottom: 0, left: 4 }} barCategoryGap="38%">
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={(v) => `Rp ${fmt(v / 1e6, 1)} Jt`} tick={AXIS} tickLine={false} axisLine={false} width={68} />
                <Tooltip
                  cursor={{ fill: "rgb(37 99 235 / 0.05)" }}
                  formatter={(v: number, n: string) => [idrJuta(v), n]}
                  contentStyle={{ background: "#ffffff", borderRadius: 8, border: "1px solid #e3ebf6", fontSize: 12 }}
                  labelStyle={{ color: "#6b7a90" }}
                  itemStyle={{ color: "#1b2541" }}
                />
                <Bar dataKey="idr_batch" name={`GOS terurai per batch ${fmt(econ.volume_L, 0)} L`} fill={C_DEG} radius={[6, 6, 0, 0]} animationDuration={450}>
                  <LabelList dataKey="idr_batch" position="top" formatter={(v: number) => idrJuta(v)} style={{ fontSize: 11, fontWeight: 700, fill: "#1b2541", fontFamily: "var(--font-sans)" }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartFrame>
          <p className="mt-1 text-xs text-muted">
            Tiap batch {fmt(econ.volume_L, 0)} L yang telat dipanen kehilangan GOS bernilai {idr(econ.price_idr_kg)}/kg.
          </p>
        </div>

        <div className="overflow-hidden rounded-lg border border-line">
          <table className="w-full text-[13px]">
            <caption className="sr-only">Kerugian per keterlambatan panen</caption>
            <thead className="bg-subtle text-[11px] uppercase tracking-[0.08em] text-muted">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-medium">Telat</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Rendemen</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Per batch</th>
                <th scope="col" className="px-3 py-2 text-right font-medium" title="GOS terurai + kapasitas reaktor yang hilang, jika setiap batch telat">Per tahun*</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.delay} className="border-t border-line transition-colors hover:bg-subtle">
                  <th scope="row" className="num px-3 py-2.5 text-left font-medium text-ink">{r.label}</th>
                  <td className="num px-3 py-2.5 text-right text-warn">−{fmt(r.yield_pts, 2)} poin</td>
                  <td className="num px-3 py-2.5 text-right font-semibold text-ink">
                    {idrJuta(r.idr_batch)}
                    <div className="text-[11px] font-normal text-muted">{fmt(r.kg_batch, 1)} kg GOS</div>
                  </td>
                  <td className={cn("num px-3 py-2.5 text-right", i === 2 ? "text-bad" : "text-body")}>
                    {idrJuta(r.total)}
                    <div className="text-[11px] font-normal text-muted">−{fmt(r.batches_lost, 0)} batch/thn</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-line px-3 py-2 text-[11px] leading-relaxed text-muted">
            *Per tahun = GOS terurai + kapasitas reaktor yang hilang bila setiap batch telat ({fmt(econ.hours_per_year, 0)} jam operasi/thn). Kapasitas hilang mengasumsikan setiap batch tambahan pasti terjual; bila permintaan yang membatasi, hanya bagian GOS terurai ({idrJuta(rows[2].degradation)} untuk +24 jam) yang berlaku.
          </p>
        </div>
      </div>
    </Panel>
  );
}
