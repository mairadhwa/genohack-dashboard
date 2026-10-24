"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { Area, AreaChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowUpRight } from "lucide-react";
import { Button, Stat, ease } from "@/components/ui/primitives";
import { deactivationRate, effectiveKacc, predict, PARAMS_F441Y, type Conditions } from "@/lib/kinetics";
import { fmt } from "@/lib/utils";
import { AXIS, SERIES, chartWindow, thin } from "./charts";

/** Expanded-row detail: full ODE trajectory and derived metrics for one operating point. */
export function RowInspector({ c, onSimulate, colSpan }: { c: Conditions; onSimulate: () => void; colSpan: number }) {
  const { trajectory, summary: s, horizon_h } = useMemo(() => predict(c), [c]);
  const xMax = chartWindow(s, horizon_h);
  const data = useMemo(() => thin(trajectory, 1).filter((d) => d.t <= xMax), [trajectory, xMax]);
  const kd = deactivationRate(c.temperature_C, PARAMS_F441Y);
  const kacc = effectiveKacc(c.temperature_C, c.pH, PARAMS_F441Y);

  // Pin the detail to the visible width of a horizontally scrolling table.
  const cellRef = useRef<HTMLTableCellElement>(null);
  const [width, setWidth] = useState<number>();
  useEffect(() => {
    let el = cellRef.current?.parentElement ?? null;
    while (el && !/(auto|scroll)/.test(getComputedStyle(el).overflowX)) el = el.parentElement;
    if (!el) return;
    const box = el;
    const ro = new ResizeObserver(() => setWidth(box.clientWidth));
    ro.observe(box);
    return () => ro.disconnect();
  }, []);

  return (
    <tr className="bg-surface">
      <td ref={cellRef} colSpan={colSpan} className="p-0">
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.22, ease } }}
          style={{ width }}
          className="sticky left-0 grid gap-4 border-y border-primary/15 px-4 py-4 md:grid-cols-[1.3fr_1fr]"
        >
          <div className="h-[170px]" role="img" aria-label="Kurva rendemen dan laktosa">
            <ResponsiveContainer>
              <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                <defs>
                  <linearGradient id="insFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor={SERIES.gos} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={SERIES.gos} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="t" type="number" domain={[0, xMax]} tickFormatter={(v) => `${v}h`} tick={AXIS} tickLine={false} axisLine={false} />
                <YAxis yAxisId="y" domain={[0, 70]} ticks={[0, 20, 40, 60]} tickFormatter={(v) => `${v}%`} tick={AXIS} tickLine={false} axisLine={false} width={44} />
                <YAxis yAxisId="l" hide domain={[0, c.lactose_g_L]} />
                <ReferenceLine yAxisId="y" x={s.peak_time_h} stroke={SERIES.gos} strokeDasharray="3 4" strokeOpacity={0.6} />
                <Tooltip
                  formatter={(v: number, n: string) => [n === "Laktosa" ? `${fmt(v, 0)} g/L` : `${fmt(v, 1)}%`, n]}
                  labelFormatter={(l: number) => `t = ${fmt(l, 1)} h`}
                  contentStyle={{ background: "#ffffff", borderRadius: 8, border: "1px solid #e3ebf6", fontSize: 12 }}
                  labelStyle={{ color: "#6b7a90" }}
                />
                <Area yAxisId="y" type="monotone" dataKey="yield_pct" name="Rendemen GOS" stroke={SERIES.gos} strokeWidth={2} fill="url(#insFill)" isAnimationActive={false} />
                <Line yAxisId="l" type="monotone" dataKey="lactose" name="Laktosa" stroke={SERIES.lactose} strokeWidth={1.5} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-col justify-between gap-3">
            <div className="grid grid-cols-3 gap-x-4 gap-y-3">
              <Stat label="Puncak" value={fmt(s.peak_yield_pct, 2)} unit="%" tone="primary" />
              <Stat label="Panen" value={fmt(s.peak_time_h, 1)} unit="jam" />
              <Stat label="Konversi" value={fmt(s.conversion_at_peak_pct, 0)} unit="%" />
              <Stat label="Rugi +6 jam" value={`−${fmt(s.loss_pts[6], 2)}`} unit="poin" tone="warn" />
              <Stat label="Rugi +12 jam" value={`−${fmt(s.loss_pts[12], 2)}`} unit="poin" tone="warn" />
              <Stat label="Rugi +24 jam" value={`−${fmt(s.loss_pts[24], 2)}`} unit="poin" tone="bad" />
              <Stat label="Sisa enzim" value={fmt(s.enzyme_remaining_pct, 0)} unit="%" />
              <Stat label="k_d" value={fmt(kd, 4)} unit="h⁻¹" />
              <Stat label="K_acc efektif" value={fmt(kacc, 1)} unit="mM" />
            </div>
            <Button variant="secondary" size="sm" className="self-start" onClick={onSimulate}>
              Buka di simulator <ArrowUpRight />
            </Button>
          </div>
        </motion.div>
      </td>
    </tr>
  );
}
