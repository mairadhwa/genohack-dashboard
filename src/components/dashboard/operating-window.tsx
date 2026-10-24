"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Grid3x3 } from "lucide-react";
import { Panel, Segmented, fadeUp } from "@/components/ui/primitives";
import yieldMap from "@/data/yield-map.json";
import { predict, OPERATING_WINDOW, type Conditions } from "@/lib/kinetics";
import { cn, fmt } from "@/lib/utils";

/** Sequential blue scale: pale sky → deep blue (low → high yield). */
const STOPS = [
  [234, 243, 255],
  [147, 197, 253],
  [37, 99, 235],
  [30, 58, 138],
];
function colorFor(v: number, lo: number, hi: number) {
  const t = Math.min(1, Math.max(0, (v - lo) / (hi - lo || 1)));
  const seg = Math.min(STOPS.length - 2, Math.floor(t * (STOPS.length - 1)));
  const f = t * (STOPS.length - 1) - seg;
  const c = STOPS[seg].map((a, i) => Math.round(a + (STOPS[seg + 1][i] - a) * f));
  return { bg: `rgb(${c.join(",")})`, fg: t > 0.45 ? "#ffffff" : "#1b2541" };
}

interface Cell { row: number; col: number; value: number | null }

function Heatmap({
  rows, cols, cells, rowFmt, colFmt, isSelected, inWindow, onPick, axis,
}: {
  rows: number[];
  cols: number[];
  cells: Cell[];
  rowFmt: (v: number) => string;
  colFmt: (v: number) => string;
  isSelected: (r: number, c: number) => boolean;
  inWindow: (r: number, c: number) => boolean;
  onPick: (r: number, c: number) => void;
  axis: string;
}) {
  const vals = cells.map((c) => c.value).filter((v): v is number => v !== null);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const best = cells.reduce<Cell | null>((a, c) => (c.value !== null && (!a || c.value > a.value!) ? c : a), null);
  const [hover, setHover] = useState<Cell | null>(null);

  return (
    <div>
      <div className="overflow-x-auto pb-1">
        <div role="grid" aria-label={axis} className="grid min-w-[520px] gap-1" style={{ gridTemplateColumns: `68px repeat(${cols.length}, minmax(0,1fr))` }}>
          <div />
          {cols.map((c) => (
            <div key={c} className="num pb-1 text-center text-[11px] text-muted">{colFmt(c)}</div>
          ))}
          {[...rows].reverse().map((r) => (
            <div key={r} role="row" className="contents">
              <div className="num flex items-center text-[11px] text-muted">{rowFmt(r)}</div>
              {cols.map((c) => {
                const cell = cells.find((x) => x.row === r && x.col === c)!;
                if (cell.value === null)
                  return (
                    <div key={c} role="gridcell" title="Melebihi kelarutan laktosa — tidak layak" className="flex h-11 items-center justify-center rounded-md border border-dashed border-line-strong text-[11px] text-muted">
                      —
                    </div>
                  );
                const { bg, fg } = colorFor(cell.value, lo, hi);
                const sel = isSelected(r, c);
                return (
                  <button
                    key={c}
                    role="gridcell"
                    onClick={() => onPick(r, c)}
                    onMouseEnter={() => setHover(cell)}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(cell)}
                    onBlur={() => setHover(null)}
                    aria-label={`${rowFmt(r)}, ${colFmt(c)}: ${fmt(cell.value, 2)} persen`}
                    className={cn(
                      "num relative flex h-11 cursor-pointer items-center justify-center rounded-md text-[12px] font-semibold transition-[transform,box-shadow,opacity] duration-150 hover:z-10 hover:shadow-[0_0_0_2px_rgb(248_250_252/0.7)] active:scale-[0.98]",
                      !inWindow(r, c) && "opacity-45",
                    )}
                    style={{ background: bg, color: fg }}
                  >
                    {fmt(cell.value, 1)}
                    {best === cell && <span className="absolute right-1 top-0.5 text-[9px]" aria-hidden>★</span>}
                    {sel && <motion.span layoutId={`hm-sel-${axis}`} className="absolute -inset-[3px] rounded-[8px] border-2 border-ink" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
        <span className="flex items-center gap-2">
          <span className="num">{fmt(lo, 1)}%</span>
          <span className="h-1.5 w-28 rounded-full" style={{ background: `linear-gradient(90deg, ${STOPS.map((s) => `rgb(${s.join(",")})`).join(",")})` }} />
          <span className="num">{fmt(hi, 1)}%</span>
        </span>
        <span className="flex items-center gap-1.5"><span className="size-3 rounded-sm border-2 border-ink" /> terpilih</span>
        <span>Pudar = di luar jendela · ★ terbaik · klik untuk memuat</span>
        <span className="num ml-auto min-w-[180px] text-right text-body" aria-live="polite">
          {hover ? `${rowFmt(hover.row)} · ${colFmt(hover.col)} → ${fmt(hover.value, 2)}%` : ""}
        </span>
      </div>
    </div>
  );
}

export function OperatingWindow({ c, onPick }: { c: Conditions; onPick: (c: Conditions) => void }) {
  const [tab, setTab] = useState<"lt" | "tp">("lt");
  const W = OPERATING_WINDOW;
  const inW = (lac: number, T: number, pH: number) =>
    lac >= W.lactose[0] && lac <= W.lactose[1] && T >= W.temperature[0] && T <= W.temperature[1] && pH >= W.pH[0] && pH <= W.pH[1];

  // Published map: hasil/peta_rendemen_F441Y.csv (pH 6.0, 9 U/mL)
  const lt = useMemo(() => {
    const rows = [...new Set(yieldMap.map((d) => d.lactose_g_L))].sort((a, b) => a - b);
    const cols = [...new Set(yieldMap.map((d) => d.temperature_C))].sort((a, b) => a - b);
    return { rows, cols, cells: yieldMap.map((d) => ({ row: d.lactose_g_L, col: d.temperature_C, value: d.yield_pct })) };
  }, []);

  // Live model: pH × temperature at the current lactose and dose
  const tp = useMemo(() => {
    if (tab !== "tp") return null;
    const rows = [4.5, 5.0, 5.5, 6.0, 6.5, 7.0];
    const cols = [65, 70, 75, 80, 85, 90];
    return { rows, cols, cells: rows.flatMap((pH) => cols.map((T) => ({ row: pH, col: T, value: predict({ ...c, temperature_C: T, pH }).summary.peak_yield_pct }))) };
  }, [tab, c]);

  return (
    <Panel
      icon={Grid3x3}
      title="Jendela operasi"
      subtitle="Rendemen puncak (% b/b) · jendela ≥95% maks: 500–800 g/L, 70–85 °C, pH 5,0–6,5"
      actions={
        <Segmented
          id="window-tabs"
          size="sm"
          value={tab}
          onChange={setTab}
          options={[
            { value: "lt", label: "Laktosa × Suhu" },
            { value: "tp", label: "pH × Suhu" },
          ]}
        />
      }
      collapsible
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={tab} {...fadeUp}>
          {tab === "lt" ? (
            <>
              <p className="mb-3 text-xs text-muted">
                Sumber <code className="num rounded bg-subtle px-1 text-body">peta_rendemen_F441Y.csv</code> · pH 6,0 · 9 U/mL · sel bergaris putus melebihi kelarutan laktosa
              </p>
              <Heatmap
                {...lt}
                axis="lt"
                rowFmt={(v) => `${v} g/L`}
                colFmt={(v) => `${v} °C`}
                isSelected={(r, col) => Math.abs(r - c.lactose_g_L) < 50 && Math.abs(col - c.temperature_C) < 2.5}
                inWindow={(r, col) => inW(r, col, 6)}
                onPick={(r, col) => onPick({ ...c, lactose_g_L: r, temperature_C: col, pH: 6 })}
              />
            </>
          ) : (
            tp && (
              <>
                <p className="mb-3 text-xs text-muted">
                  Model langsung pada <span className="num text-body">{c.lactose_g_L} g/L</span>, <span className="num text-body">{c.enzyme_U_mL} U/mL</span> · sel di luar 65–85 °C / pH 4,5–6,5 adalah ekstrapolasi
                </p>
                <Heatmap
                  {...tp}
                  axis="tp"
                  rowFmt={(v) => `pH ${fmt(v, 1)}`}
                  colFmt={(v) => `${v} °C`}
                  isSelected={(r, col) => Math.abs(r - c.pH) < 0.25 && Math.abs(col - c.temperature_C) < 2.5}
                  inWindow={(r, col) => inW(c.lactose_g_L, col, r)}
                  onPick={(r, col) => onPick({ ...c, pH: r, temperature_C: col })}
                />
              </>
            )
          )}
        </motion.div>
      </AnimatePresence>
    </Panel>
  );
}
