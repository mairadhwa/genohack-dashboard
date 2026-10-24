"use client";

import { useRef } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ImageDown } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import type { PeakSummary, TrajectoryPoint } from "@/lib/kinetics";
import { downloadChartSvg } from "@/lib/export";
import { fmt } from "@/lib/utils";

/** Series colours: distinct in hue AND lightness so lines stay separable without colour vision. */
export const SERIES = {
  gos: "#2563eb",
  lactose: "#14b8a6",
  glucose: "#f59e0b",
  galactose: "#ec4899",
  enzyme: "#6b7a90",
};

export const AXIS = { fill: "#6b7a90", fontSize: 11, fontFamily: "var(--font-sans)" };
const TICK = { tick: AXIS, tickLine: false, axisLine: false } as const;

const hourTicks = (xMax: number) => {
  const step = xMax > 72 ? 12 : 6;
  return Array.from({ length: Math.floor(xMax / step) + 1 }, (_, i) => i * step);
};

/** Keep ~1 point per 0.5 h for smooth, cheap rendering. */
export function thin(traj: TrajectoryPoint[], step = 0.5) {
  const out: TrajectoryPoint[] = [];
  let next = 0;
  for (const p of traj) if (p.t >= next - 1e-9) { out.push(p); next += step; }
  return out;
}

export const chartWindow = (s: PeakSummary, horizon: number) => Math.min(horizon, Math.ceil((s.peak_time_h + 30) / 6) * 6);

type TipItem = { name: string; value: number; color: string; dataKey: string };
function Tip({ active, payload, label, units }: { active?: boolean; payload?: TipItem[]; label?: number; units: Record<string, string> }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-[180px] rounded-lg border border-line-strong bg-surface/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      <div className="num mb-1.5 text-muted">t = {fmt(label, 1)} h</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-6 py-0.5">
          <span className="flex items-center gap-1.5 text-body">
            <span className="h-0.5 w-3 rounded-full" style={{ background: p.color }} /> {p.name}
          </span>
          <span className="num font-medium text-ink">
            {fmt(p.value, 1)} <span className="text-muted">{units[p.dataKey] ?? ""}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

/** Wraps a chart with a consistent height and an SVG export button. */
export function ChartFrame({ name, title, height = 300, children }: { name: string; title: string; height?: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div className="relative">
      <div ref={ref} style={{ height }} role="img" aria-label={title}>
        {children}
      </div>
      <Button
        variant="ghost"
        size="xs"
        className="absolute -top-1 right-0"
        onClick={() => downloadChartSvg(ref.current, `${name}.svg`, title)}
        aria-label={`Unduh ${title} sebagai SVG`}
      >
        <ImageDown /> SVG
      </Button>
    </div>
  );
}

export function YieldCurveChart({ traj, s, horizon }: { traj: TrajectoryPoint[]; s: PeakSummary; horizon: number }) {
  const xMax = chartWindow(s, horizon);
  const data = thin(traj).filter((d) => d.t <= xMax);
  const yMax = Math.ceil((s.peak_yield_pct + 6) / 10) * 10;
  return (
    <ChartFrame name="gos_yield_curve" title="Rendemen GOS dari waktu ke waktu">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 24, right: 16, bottom: 0, left: -4 }}>
          <defs>
            <linearGradient id="yieldFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={SERIES.gos} stopOpacity={0.3} />
              <stop offset="100%" stopColor={SERIES.gos} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="t" type="number" domain={[0, xMax]} ticks={hourTicks(xMax)} tickFormatter={(v) => `${v}h`} {...TICK} />
          <YAxis domain={[0, yMax]} ticks={Array.from({ length: yMax / 10 + 1 }, (_, i) => i * 10)} tickFormatter={(v) => `${v}%`} width={44} {...TICK} />
          <ReferenceArea x1={s.peak_time_h} x2={xMax} fill="#ef4444" fillOpacity={0.06} label={{ value: "DEGRADASI", position: "insideTopRight", fill: "#ef4444", fontSize: 10, letterSpacing: 1 }} />
          <ReferenceLine x={s.peak_time_h} stroke={SERIES.gos} strokeDasharray="3 4" strokeOpacity={0.6} label={{ value: `panen ${fmt(s.peak_time_h, 1)} jam`, position: "insideBottomRight", fill: SERIES.gos, fontSize: 10 }} />
          <Tooltip content={<Tip units={{ yield_pct: "%" }} />} cursor={{ stroke: "rgb(37 99 235 / 0.3)" }} />
          <Area type="monotone" dataKey="yield_pct" name="Rendemen GOS" stroke={SERIES.gos} strokeWidth={2} fill="url(#yieldFill)" animationDuration={450} />
          <ReferenceDot x={s.peak_time_h} y={s.peak_yield_pct} r={5} fill={SERIES.gos} stroke="#ffffff" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function ReactorContentChart({ traj, s, horizon }: { traj: TrajectoryPoint[]; s: PeakSummary; horizon: number }) {
  const xMax = chartWindow(s, horizon);
  const data = thin(traj).filter((d) => d.t <= xMax);
  const lines = [
    { key: "lactose", name: "Laktosa", dash: undefined },
    { key: "gos", name: "GOS", dash: undefined },
    { key: "glucose", name: "Glukosa", dash: "6 3" },
    { key: "galactose", name: "Galaktosa", dash: "2 3" },
  ] as const;
  return (
    <div>
      <ChartFrame name="reactor_content" title="Isi reaktor (g/L)">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 24, right: 16, bottom: 0, left: -4 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="t" type="number" domain={[0, xMax]} ticks={hourTicks(xMax)} tickFormatter={(v) => `${v}h`} {...TICK} />
            <YAxis width={44} {...TICK} />
            <ReferenceLine x={s.peak_time_h} stroke={SERIES.gos} strokeDasharray="3 4" strokeOpacity={0.5} />
            <Tooltip content={<Tip units={{ lactose: "g/L", gos: "g/L", glucose: "g/L", galactose: "g/L" }} />} cursor={{ stroke: "rgb(37 99 235 / 0.3)" }} />
            {lines.map((l) => (
              <Line key={l.key} type="monotone" dataKey={l.key} name={l.name} stroke={SERIES[l.key]} strokeWidth={l.key === "gos" ? 2.5 : 1.75} strokeDasharray={l.dash} dot={false} animationDuration={450} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </ChartFrame>
      <Legend items={lines.map((l) => ({ label: l.name, color: SERIES[l.key], dash: l.dash }))} />
    </div>
  );
}

export function DeactivationChart({ traj, s, horizon, kd }: { traj: TrajectoryPoint[]; s: PeakSummary; horizon: number; kd: number }) {
  const xMax = chartWindow(s, horizon);
  const data = thin(traj).filter((d) => d.t <= xMax);
  const half = Math.log(2) / kd;
  return (
    <div>
      <ChartFrame name="thermal_deactivation" title="Enzim aktif (%)">
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 24, right: 16, bottom: 0, left: -4 }}>
            <defs>
              <linearGradient id="enzFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="t" type="number" domain={[0, xMax]} ticks={hourTicks(xMax)} tickFormatter={(v) => `${v}h`} {...TICK} />
            <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v) => `${v}%`} width={44} {...TICK} />
            <ReferenceLine y={50} stroke="#6b7a90" strokeDasharray="2 4" strokeOpacity={0.5} />
            <ReferenceLine x={s.peak_time_h} stroke={SERIES.gos} strokeDasharray="3 4" strokeOpacity={0.6} label={{ value: "panen", position: "insideTopLeft", fill: SERIES.gos, fontSize: 10 }} />
            <Tooltip content={<Tip units={{ enzyme_pct: "%" }} />} cursor={{ stroke: "rgb(139 92 246 / 0.35)" }} />
            <Area type="monotone" dataKey="enzyme_pct" name="Enzim aktif" stroke="#8b5cf6" strokeWidth={2} fill="url(#enzFill)" animationDuration={450} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartFrame>
      <p className="mt-2 text-xs text-muted">
        Deaktivasi orde pertama, k<sub>d</sub> = <span className="num text-body">{fmt(kd, 4)}</span> h⁻¹ · waktu paruh{" "}
        <span className="num text-body">{fmt(half, 1)} jam</span> pada suhu ini (Park dkk. 2008: 72 jam di 80 °C).
      </p>
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string; dash?: string }[] }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <svg width="18" height="6" aria-hidden>
            <line x1="0" y1="3" x2="18" y2="3" stroke={i.color} strokeWidth="2" strokeDasharray={i.dash} />
          </svg>
          {i.label}
        </li>
      ))}
    </ul>
  );
}
