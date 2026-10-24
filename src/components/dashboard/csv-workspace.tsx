"use client";

/**
 * CSV analysis workspace (split-pane, CASTpFold-style).
 *
 *  LEFT  — intake: dropzone, pipeline status (parse → map → predict → log),
 *          column-mapping preview, batch summary.
 *  RIGHT — analysis canvas: predictions table (sortable, searchable,
 *          expandable rows with full ODE detail) and a batch overview chart,
 *          plus exports (enriched CSV, JSON report, SVG).
 *
 * Predictions run in the browser in small chunks (progress bar, no UI freeze);
 * /api/predict then recomputes server-side and logs to Supabase.
 */
import { Fragment, useCallback, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { AnimatePresence, motion } from "motion/react";
import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import {
  AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, Braces, Check, CheckCircle2, ChevronRight, Circle, ClipboardCopy,
  CloudOff, Database, Download, FileSpreadsheet, FileUp, Loader2, Search, Table2, ScatterChart as ScatterIcon, X,
} from "lucide-react";
import { Badge, Button, Input, Segmented, Skeleton, fadeUp } from "@/components/ui/primitives";
import {
  detectColumns, FIELD_INFO, mapRows, predictRow, summarizeBatch, TEMPLATE_CSV, toEnrichedRecords, MODEL_VERSION,
  type PredictedRow, type RawRow, type RowError, type ModelField,
} from "@/lib/csv-predict";
import type { Conditions } from "@/lib/kinetics";
import { copyText, downloadText } from "@/lib/export";
import { cn, fmt } from "@/lib/utils";
import { AXIS, ChartFrame } from "./charts";
import { RowInspector } from "./row-inspector";

type StepState = "idle" | "run" | "done" | "error" | "skip";
type Pipeline = { parse: StepState; map: StepState; predict: StepState; log: StepState };
const IDLE: Pipeline = { parse: "idle", map: "idle", predict: "idle", log: "idle" };
const MODEL_MAX = 63.02; // best yield in the grid search

const FLAG_LABEL: Record<string, string> = {
  outside_operating_window: "di luar jendela",
  above_solubility: "lewat kelarutan",
  extrapolation: "ekstrapolasi",
};

// ---------------------------------------------------------------------------
// Left pane pieces
// ---------------------------------------------------------------------------
function StepIcon({ s }: { s: StepState }) {
  if (s === "run")
    return (
      <span className="relative flex size-4 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-primary/40" />
        <span className="size-2 rounded-full bg-primary" />
      </span>
    );
  if (s === "done") return <CheckCircle2 className="size-4 text-ok" />;
  if (s === "error") return <AlertTriangle className="size-4 text-bad" />;
  if (s === "skip") return <CloudOff className="size-4 text-muted" />;
  return <Circle className="size-4 text-muted" />;
}

function PipelineView({ p, progress, detail }: { p: Pipeline; progress: number; detail: Partial<Record<keyof Pipeline, string>> }) {
  const steps: { key: keyof Pipeline; label: string }[] = [
    { key: "parse", label: "Baca CSV" },
    { key: "map", label: "Petakan kolom" },
    { key: "predict", label: "Jalankan model ODE" },
    { key: "log", label: "Simpan ke Supabase" },
  ];
  return (
    <ol className="space-y-0" aria-label="Alur pemrosesan">
      {steps.map((st, i) => (
        <li key={st.key} className="relative flex gap-3 pb-3 last:pb-0">
          {i < steps.length - 1 && <span className="absolute left-[7.5px] top-5 h-[calc(100%-16px)] w-px bg-line-strong" aria-hidden />}
          <span className="relative z-10 mt-0.5 bg-surface"><StepIcon s={p[st.key]} /></span>
          <div className="min-w-0 flex-1">
            <div className={cn("text-[13px]", p[st.key] === "idle" ? "text-muted" : "text-ink")}>{st.label}</div>
            {detail[st.key] && <div className="truncate text-xs text-muted">{detail[st.key]}</div>}
            {st.key === "predict" && p.predict === "run" && (
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
                <motion.div className="h-full bg-gradient-to-r from-indigo-deep to-primary" animate={{ width: `${progress * 100}%` }} transition={{ duration: 0.15 }} />
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

function MappingPreview({ mapping }: { mapping: Partial<Record<ModelField, string>> }) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line text-xs">
      {FIELD_INFO.map((f) => {
        const src = mapping[f.field];
        return (
          <li key={f.field} className="flex items-center justify-between gap-2 px-2.5 py-1.5">
            <span className="text-body">{f.label}</span>
            {src ? (
              <span className="flex items-center gap-1 text-ok">
                <code className="num max-w-[120px] truncate rounded bg-subtle px-1 text-body">{src}</code>
                <Check className="size-3" />
              </span>
            ) : f.required ? (
              <span className="text-bad">tidak ada</span>
            ) : (
              <span className="text-muted">{f.fallback ?? "tidak diisi"}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Right pane: predictions table
// ---------------------------------------------------------------------------
type SortKey = "row_index" | "lactose_g_L" | "temperature_C" | "pH" | "enzyme_U_mL" | "pred_peak_yield_pct" | "pred_harvest_h" | "pred_gos_g_L" | "pred_loss_12h_pts";
const COLS: { key: SortKey; label: string; unit?: string; d: number }[] = [
  { key: "row_index", label: "#", d: 0 },
  { key: "lactose_g_L", label: "Laktosa", unit: "g/L", d: 0 },
  { key: "temperature_C", label: "Suhu", unit: "°C", d: 1 },
  { key: "pH", label: "pH", d: 2 },
  { key: "enzyme_U_mL", label: "Enzim", unit: "U/mL", d: 1 },
  { key: "pred_peak_yield_pct", label: "Rendemen puncak", unit: "%", d: 2 },
  { key: "pred_harvest_h", label: "Panen", unit: "h", d: 1 },
  { key: "pred_gos_g_L", label: "GOS", unit: "g/L", d: 0 },
  { key: "pred_loss_12h_pts", label: "Rugi +12 jam", unit: "poin", d: 2 },
];

function yieldTone(v: number) {
  const r = v / MODEL_MAX;
  if (r >= 0.95) return "bg-primary-soft text-primary border-primary/25";
  if (r >= 0.9) return "bg-indigo/10 text-indigo border-indigo/25";
  return "bg-subtle text-muted border-line";
}

function PredictionsTable({ rows, onSimulate }: { rows: PredictedRow[]; onSimulate: (c: Conditions) => void }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "row_index", dir: 1 });
  const [open, setOpen] = useState<number | null>(null);
  const maxLoss = Math.max(...rows.map((r) => r.pred_loss_12h_pts), 0.01);

  const view = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows
      .filter((r) => !t || [r.row_index + 1, r.lactose_g_L, r.temperature_C, r.pH, ...r.flags, ...Object.values(r.raw)].some((v) => String(v).toLowerCase().includes(t)))
      .sort((a, b) => (a[sort.key] - b[sort.key]) * sort.dir);
  }, [rows, q, sort]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Saring baris, nilai, penanda…" className="h-8 pl-8" aria-label="Saring prediksi" />
        </div>
        <span className="num text-xs text-muted">{view.length} dari {rows.length} baris · klik baris untuk detail ODE</span>
      </div>
      <div className="max-h-[560px] overflow-auto rounded-lg border border-line">
        <table className="w-full min-w-[920px] border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr>
              <th className="sticky top-0 z-10 w-8 border-b border-line bg-subtle" aria-label="Buka detail" />
              {COLS.map((c) => {
                const active = sort.key === c.key;
                const Icon = !active ? ArrowUpDown : sort.dir === 1 ? ArrowUp : ArrowDown;
                return (
                  <th key={c.key} scope="col" aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"} className="sticky top-0 z-10 border-b border-line bg-subtle px-2.5 py-2 text-right text-[11px] font-medium uppercase tracking-[0.06em] text-muted first-of-type:text-left">
                    <button
                      onClick={() => setSort((s) => (s.key === c.key ? { key: c.key, dir: (s.dir * -1) as 1 | -1 } : { key: c.key, dir: c.key === "row_index" ? 1 : -1 }))}
                      className={cn("inline-flex cursor-pointer items-center gap-1 whitespace-nowrap transition-colors hover:text-body", active && "text-primary")}
                    >
                      {c.label}
                      {c.unit && <span className="normal-case tracking-normal opacity-70">{c.unit}</span>}
                      <Icon className="size-3" />
                    </button>
                  </th>
                );
              })}
              <th scope="col" className="sticky top-0 z-10 whitespace-nowrap border-b border-line bg-subtle px-2.5 py-2 text-left text-[11px] font-medium uppercase tracking-[0.06em] text-muted" title="Titik terdekat di data referensi server (pencarian grid, 9 U/mL)">Grid acuan</th>
              <th scope="col" className="sticky top-0 z-10 border-b border-line bg-subtle px-2.5 py-2 text-left text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Teramati</th>
              <th scope="col" className="sticky top-0 z-10 border-b border-line bg-subtle px-2.5 py-2 text-left text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Penanda</th>
            </tr>
          </thead>
          <tbody>
            {view.map((r) => {
              const isOpen = open === r.row_index;
              const resid = r.obs_yield_pct !== null ? r.obs_yield_pct - r.pred_peak_yield_pct : null;
              const lossA = r.pred_loss_12h_pts / maxLoss;
              return (
                <Fragment key={r.row_index}>
                  <tr
                    onClick={() => setOpen(isOpen ? null : r.row_index)}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setOpen(isOpen ? null : r.row_index))}
                    tabIndex={0}
                    aria-expanded={isOpen}
                    className={cn("cursor-pointer transition-colors hover:bg-subtle focus-visible:bg-subtle", isOpen && "bg-primary/[0.04]")}
                  >
                    <td className="border-b border-line pl-2.5">
                      <ChevronRight className={cn("size-3.5 text-muted transition-transform duration-200", isOpen && "rotate-90 text-primary")} />
                    </td>
                    <td className="num border-b border-line px-2.5 py-2 text-left text-muted">{r.row_index + 1}</td>
                    <td className="num border-b border-line px-2.5 py-2 text-right">{fmt(r.lactose_g_L, 0)}</td>
                    <td className="num border-b border-line px-2.5 py-2 text-right">{fmt(r.temperature_C, 1)}</td>
                    <td className="num border-b border-line px-2.5 py-2 text-right">{fmt(r.pH, 2)}</td>
                    <td className="num border-b border-line px-2.5 py-2 text-right">{fmt(r.enzyme_U_mL, 1)}</td>
                    <td className="border-b border-line px-2.5 py-1.5 text-right">
                      <span className={cn("num inline-block rounded-md border px-1.5 py-px font-semibold", yieldTone(r.pred_peak_yield_pct))}>{fmt(r.pred_peak_yield_pct, 2)}</span>
                    </td>
                    <td className="num border-b border-line px-2.5 py-2 text-right">{fmt(r.pred_harvest_h, 1)}</td>
                    <td className="num border-b border-line px-2.5 py-2 text-right">{fmt(r.pred_gos_g_L, 0)}</td>
                    <td className="num border-b border-line px-2.5 py-2 text-right text-ink" style={{ background: `rgb(248 113 113 / ${0.04 + lossA * 0.16})` }}>
                      −{fmt(r.pred_loss_12h_pts, 2)}
                    </td>
                    <td className="num whitespace-nowrap border-b border-line px-2.5 py-2">
                      {r.grid_yield_pct === undefined ? (
                        <span className="text-muted" title="Menunggu pencocokan di server">…</span>
                      ) : (
                        <span title={`${r.grid_lactose_g_L} g/L · ${r.grid_temperature_C} °C · pH ${fmt(r.grid_pH, 1)}`}>
                          {fmt(r.grid_yield_pct, 1)}%{" "}
                          <span className={cn("text-[11px]", r.grid_exact ? "text-ok" : "text-muted")}>{r.grid_exact ? "tepat" : "terdekat"}</span>
                        </span>
                      )}
                    </td>
                    <td className="num border-b border-line px-2.5 py-2">
                      {resid === null ? (
                        <span className="text-muted">—</span>
                      ) : (
                        <span>
                          {fmt(r.obs_yield_pct, 1)}{" "}
                          <span className={cn("text-xs", Math.abs(resid) > 3 ? "text-warn" : "text-ok")}>({resid > 0 ? "+" : ""}{fmt(resid, 1)})</span>
                        </span>
                      )}
                    </td>
                    <td className="border-b border-line px-2.5 py-1.5">
                      {r.flags.length === 0 ? (
                        <span className="flex items-center gap-1 text-xs text-ok"><CheckCircle2 className="size-3.5" /> aman</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {r.flags.map((f) => <Badge key={f} tone={f === "above_solubility" ? "bad" : "warn"}>{FLAG_LABEL[f]}</Badge>)}
                        </div>
                      )}
                    </td>
                  </tr>
                  {isOpen && <RowInspector c={r} colSpan={COLS.length + 4} onSimulate={() => onSimulate(r)} />}
                </Fragment>
              );
            })}
            {view.length === 0 && (
              <tr><td colSpan={COLS.length + 4} className="px-4 py-10 text-center text-muted">Tidak ada baris yang cocok.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm border border-primary/40 bg-primary-soft" /> ≥95% dari maks model</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm border border-indigo/40 bg-indigo/10" /> 90–95%</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-bad/25" /> makin merah = rugi telat panen makin besar</span>
      </div>
    </div>
  );
}

function BatchOverview({ rows }: { rows: PredictedRow[] }) {
  const ok = rows.filter((r) => !r.flags.length).map((r) => ({ x: r.pred_harvest_h, y: r.pred_peak_yield_pct, z: r.lactose_g_L, row: r.row_index + 1 }));
  const flagged = rows.filter((r) => r.flags.length).map((r) => ({ x: r.pred_harvest_h, y: r.pred_peak_yield_pct, z: r.lactose_g_L, row: r.row_index + 1 }));
  // Rounded, evenly spaced axis ticks
  const niceTicks = (vals: number[], step: number) => {
    const lo = Math.floor(Math.min(...vals) / step) * step;
    const hi = Math.ceil(Math.max(...vals) / step) * step;
    return Array.from({ length: Math.round((hi - lo) / step) + 1 }, (_, i) => lo + i * step);
  };
  const xs = rows.map((r) => r.pred_harvest_h), ys = rows.map((r) => r.pred_peak_yield_pct);
  const xSpan = Math.max(...xs) - Math.min(...xs), ySpan = Math.max(...ys) - Math.min(...ys);
  const xTicks = niceTicks(xs, xSpan > 60 ? 20 : xSpan > 20 ? 10 : 5);
  const yTicks = niceTicks(ys, ySpan > 20 ? 5 : ySpan > 6 ? 2 : 1);
  return (
    <div>
      <p className="mb-3 text-xs text-muted">Tiap titik = satu batch: waktu panen vs rendemen puncak. Kiri atas paling baik (rendemen tinggi, siklus pendek). Ukuran titik = laktosa awal.</p>
      <ChartFrame name="batch_overview" title="Gambaran batch: waktu panen vs rendemen puncak" height={360}>
        <ResponsiveContainer>
          <ScatterChart margin={{ top: 24, right: 16, bottom: 12, left: 0 }}>
            <CartesianGrid />
            <XAxis type="number" dataKey="x" name="Panen" unit=" jam" tick={AXIS} tickLine={false} axisLine={false} domain={[xTicks[0], xTicks[xTicks.length - 1]]} ticks={xTicks} tickFormatter={(v) => fmt(v, 0)} />
            <YAxis type="number" dataKey="y" name="Rendemen puncak" unit="%" tick={AXIS} tickLine={false} axisLine={false} width={52} domain={[yTicks[0], yTicks[yTicks.length - 1]]} ticks={yTicks} tickFormatter={(v) => fmt(v, 0)} />
            <ZAxis type="number" dataKey="z" range={[60, 260]} name="Laktosa" unit=" g/L" />
            <Tooltip
              cursor={{ strokeDasharray: "3 3", stroke: "rgb(107 122 144 / 0.4)" }}
              formatter={(v: number, n: string) => [fmt(v, 1), n]}
              contentStyle={{ background: "#ffffff", borderRadius: 8, border: "1px solid #e3ebf6", fontSize: 12 }}
              itemStyle={{ color: "#1b2541" }}
            />
            <Scatter name="Di dalam jendela" data={ok} fill="#2563eb" fillOpacity={0.75} stroke="#ffffff" />
            <Scatter name="Ditandai" data={flagged} fill="#f59e0b" fillOpacity={0.75} stroke="#ffffff" shape="diamond" />
          </ScatterChart>
        </ResponsiveContainer>
      </ChartFrame>
      <ul className="mt-2 flex gap-4 text-xs text-muted">
        <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-primary" /> Tanpa penanda</li>
        <li className="flex items-center gap-1.5"><span className="size-2.5 rotate-45 bg-warn" /> Ditandai (di luar jendela, ekstrapolasi, atau lewat kelarutan)</li>
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Workspace
// ---------------------------------------------------------------------------
export function CsvWorkspace({ onSimulate }: { onSimulate: (c: Conditions) => void }) {
  const [file, setFile] = useState<{ name: string; size: number } | null>(null);
  const [pipe, setPipe] = useState<Pipeline>(IDLE);
  const [detail, setDetail] = useState<Partial<Record<keyof Pipeline, string>>>({});
  const [progress, setProgress] = useState(0);
  const [mapping, setMapping] = useState<Partial<Record<ModelField, string>> | null>(null);
  const [rows, setRows] = useState<PredictedRow[]>([]);
  const [errors, setErrors] = useState<RowError[]>([]);
  const [fatal, setFatal] = useState<string | null>(null);
  const [view, setView] = useState<"table" | "overview">("table");
  const [drag, setDrag] = useState(false);
  const [copied, setCopied] = useState(false);
  const [batchId, setBatchId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const runId = useRef(0);

  const busy = pipe.parse === "run" || pipe.map === "run" || pipe.predict === "run";
  const summary = useMemo(() => summarizeBatch(rows), [rows]);

  const process = useCallback(async (name: string, size: number, raw: RawRow[]) => {
    const id = ++runId.current;
    const alive = () => id === runId.current;
    setFile({ name, size });
    setFatal(null);
    setRows([]);
    setErrors([]);
    setBatchId(null);
    setProgress(0);
    setPipe({ parse: "done", map: "run", predict: "idle", log: "idle" });
    setDetail({ parse: `${raw.length} baris data · ${Object.keys(raw[0] ?? {}).length} kolom` });

    // Map
    const cols = detectColumns(Object.keys(raw[0] ?? {}));
    setMapping(cols);
    const { inputs, errors, missingColumns } = mapRows(raw);
    if (missingColumns.length) {
      setPipe((p) => ({ ...p, map: "error" }));
      setDetail((d) => ({ ...d, map: `Tidak ada: ${missingColumns.join(", ")}` }));
      setFatal(`Kolom wajib tidak ditemukan: ${missingColumns.join(", ")}. Unduh templat untuk melihat nama kolom yang diterima.`);
      return;
    }
    setErrors(errors);
    setPipe((p) => ({ ...p, map: "done", predict: "run" }));
    setDetail((d) => ({ ...d, map: `${inputs.length} valid${errors.length ? ` · ${errors.length} dilewati` : ""}` }));

    // Predict in chunks so the UI stays responsive and shows progress
    const out: PredictedRow[] = [];
    const CHUNK = 25;
    for (let i = 0; i < inputs.length; i += CHUNK) {
      if (!alive()) return;
      for (const r of inputs.slice(i, i + CHUNK)) out.push(predictRow(r));
      setProgress(Math.min(1, (i + CHUNK) / inputs.length));
      await new Promise((res) => setTimeout(res, 0));
    }
    if (!alive()) return;
    setRows(out);
    setPipe((p) => ({ ...p, predict: "done", log: "run" }));
    setDetail((d) => ({ ...d, predict: `${out.length} kurva dihitung` }));

    // Log (server recomputes before saving)
    try {
      const res = await fetch("/api/predict", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows: raw, fileName: name }) });
      const j = await res.json();
      if (!alive()) return;
      // Attach the server's nearest-grid match to each previewed row.
      if (Array.isArray(j.predictions)) {
        const byRow = new Map<number, Partial<PredictedRow>>(j.predictions.map((p: PredictedRow) => [p.row_index, p]));
        setRows((prev) =>
          prev.map((r) => {
            const s = byRow.get(r.row_index);
            return s ? { ...r, grid_lactose_g_L: s.grid_lactose_g_L, grid_temperature_C: s.grid_temperature_C, grid_pH: s.grid_pH, grid_yield_pct: s.grid_yield_pct, grid_harvest_h: s.grid_harvest_h, grid_distance: s.grid_distance, grid_exact: s.grid_exact } : r;
          }),
        );
      }
      if (j.persisted) {
        setBatchId(j.batchId);
        setPipe((p) => ({ ...p, log: "done" }));
        setDetail((d) => ({ ...d, log: `Batch ${String(j.batchId).slice(0, 8)} · ${j.predictions.length} baris tersimpan` }));
      } else if (j.reason === "Supabase belum dikonfigurasi") {
        setPipe((p) => ({ ...p, log: "skip" }));
        setDetail((d) => ({ ...d, log: "Mode offline — tidak disimpan" }));
      } else {
        setPipe((p) => ({ ...p, log: "error" }));
        setDetail((d) => ({ ...d, log: j.reason ?? j.error ?? "Gagal menyimpan" }));
      }
    } catch (e) {
      if (!alive()) return;
      setPipe((p) => ({ ...p, log: "error" }));
      setDetail((d) => ({ ...d, log: String(e) }));
    }
  }, []);

  const handleFile = (f: File) => {
    if (!/\.(csv|txt)$/i.test(f.name)) return setFatal("Pilih file berformat .csv.");
    if (f.size > 5_000_000) return setFatal("Ukuran file lebih dari 5 MB.");
    setPipe({ ...IDLE, parse: "run" });
    setFatal(null);
    Papa.parse<RawRow>(f, {
      header: true,
      skipEmptyLines: "greedy",
      complete: (res) => {
        if (!res.data.length) {
          setPipe({ ...IDLE, parse: "error" });
          return setFatal("CSV hanya berisi judul kolom, tanpa baris data.");
        }
        if (res.data.length > 2000) {
          setPipe({ ...IDLE, parse: "error" });
          return setFatal(`CSV berisi ${res.data.length} baris; batasnya 2.000 per unggahan.`);
        }
        process(f.name, f.size, res.data);
      },
      error: (err) => {
        setPipe({ ...IDLE, parse: "error" });
        setFatal(err.message);
      },
    });
  };

  const loadSample = () => process("sample_batches.csv", TEMPLATE_CSV.length, Papa.parse<RawRow>(TEMPLATE_CSV, { header: true, skipEmptyLines: true }).data);

  const reset = () => {
    runId.current++;
    setFile(null);
    setPipe(IDLE);
    setDetail({});
    setMapping(null);
    setRows([]);
    setErrors([]);
    setFatal(null);
    setBatchId(null);
  };

  const report = () =>
    JSON.stringify(
      {
        model_version: MODEL_VERSION,
        file: file?.name,
        generated_at: new Date().toISOString(),
        supabase_batch_id: batchId,
        summary,
        skipped: errors,
        rows: toEnrichedRecords(rows),
      },
      null,
      2,
    );

  const baseName = (file?.name ?? "batches").replace(/\.(csv|txt)$/i, "");

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
      {/* ------------------------------ LEFT: intake ------------------------------ */}
      <aside className="flex flex-col gap-4 lg:sticky lg:top-[72px] lg:self-start">
        <div className="panel p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[13px] font-semibold text-ink">Masukan</h3>
            <div className="flex gap-1">
              <Button variant="ghost" size="xs" onClick={() => downloadText("gos_batch_template.csv", TEMPLATE_CSV)}>
                <FileSpreadsheet /> Templat
              </Button>
              <Button variant="ghost" size="xs" onClick={loadSample} disabled={busy}>Contoh</Button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            disabled={busy}
            className={cn(
              "group flex w-full cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-4 py-6 text-center transition-[border-color,background,transform] duration-150 active:scale-[0.99]",
              drag ? "border-primary bg-primary-soft" : "border-line-strong bg-surface hover:border-primary/50 hover:bg-primary/[0.03]",
            )}
          >
            <span className={cn("flex size-9 items-center justify-center rounded-full border transition-colors", drag ? "border-primary/60 bg-primary-soft" : "border-line-strong bg-subtle group-hover:border-primary/40")}>
              {busy ? <Loader2 className="size-4 animate-spin text-primary" /> : <FileUp className="size-4 text-primary" />}
            </span>
            <span className="mt-2.5 text-[13px] font-medium text-ink">{drag ? "Lepas untuk dianalisis" : "Seret CSV atau pilih file"}</span>
            <span className="mt-0.5 text-xs text-muted">≤ 2.000 baris · ≤ 5 MB · kolom EN/ID</span>
          </button>
          <input ref={inputRef} type="file" accept=".csv,text/csv" className="sr-only" tabIndex={-1} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />

          <AnimatePresence>
            {file && (
              <motion.div {...fadeUp} className="mt-3 flex items-center gap-2 rounded-lg border border-line bg-subtle px-2.5 py-2">
                <FileSpreadsheet className="size-4 shrink-0 text-indigo" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] text-ink">{file.name}</div>
                  <div className="num text-[11px] text-muted">{fmt(file.size / 1024, 1)} KB</div>
                </div>
                <Button variant="ghost" size="icon-sm" onClick={reset} aria-label="Hapus file"><X /></Button>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {fatal && (
              <motion.p {...fadeUp} role="alert" className="mt-3 flex items-start gap-2 rounded-lg border border-bad/30 bg-bad/10 px-2.5 py-2 text-xs text-bad">
                <AlertTriangle className="mt-px size-3.5 shrink-0" /> {fatal}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        <div className="panel p-4">
          <h3 className="mb-3 text-[13px] font-semibold text-ink">Alur</h3>
          <PipelineView p={pipe} progress={progress} detail={detail} />
          {errors.length > 0 && (
            <details className="mt-3 text-xs">
              <summary className="cursor-pointer text-warn">{errors.length} baris dilewati</summary>
              <ul className="mt-1.5 max-h-28 space-y-0.5 overflow-auto text-muted">
                {errors.slice(0, 50).map((e) => <li key={e.row_index}>Baris {e.row_index + 1}: {e.message}</li>)}
              </ul>
            </details>
          )}
        </div>

        <AnimatePresence>
          {mapping && (
            <motion.div {...fadeUp} className="panel p-4">
              <h3 className="mb-3 text-[13px] font-semibold text-ink">Pemetaan kolom</h3>
              <MappingPreview mapping={mapping} />
            </motion.div>
          )}
        </AnimatePresence>
      </aside>

      {/* ---------------------------- RIGHT: analysis ----------------------------- */}
      <div className="flex min-w-0 flex-col gap-4">
        {/* Summary strip */}
        <div className="panel grid grid-cols-2 gap-px overflow-hidden bg-line! sm:grid-cols-4">
          {[
            { k: "Baris diprediksi", v: summary ? fmt(summary.rows, 0) : "—" },
            { k: "Rata-rata rendemen", v: summary ? `${fmt(summary.mean_yield_pct, 1)}%` : "—" },
            { k: "Batch terbaik", v: summary ? `#${summary.best_row} · ${fmt(summary.best_yield_pct, 1)}%` : "—" },
            {
              k: summary?.observed_rows ? "RMSE vs teramati" : "Baris ditandai",
              v: summary ? (summary.observed_rows ? `${fmt(summary.rmse_pts, 2)} poin` : fmt(summary.flagged_rows, 0)) : "—",
            },
          ].map((m) => (
            <div key={m.k} className="bg-surface px-4 py-3">
              <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">{m.k}</div>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={m.v} {...fadeUp} className="num mt-1 text-lg font-semibold text-ink">{m.v}</motion.div>
              </AnimatePresence>
            </div>
          ))}
        </div>

        <div className="panel">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
            <Segmented
              id="csv-view"
              size="sm"
              value={view}
              onChange={setView}
              options={[
                { value: "table", label: <><Table2 className="size-3.5" /> Prediksi</> },
                { value: "overview", label: <><ScatterIcon className="size-3.5" /> Gambaran batch</> },
              ]}
            />
            <div className="flex flex-wrap items-center gap-1.5">
              {pipe.log === "done" && <Badge tone="ok"><Database className="size-3" /> tersimpan</Badge>}
              {pipe.log === "skip" && <Badge tone="muted"><CloudOff className="size-3" /> tidak disimpan</Badge>}
              <Button size="sm" variant="primary" disabled={!rows.length} onClick={() => downloadText(`${baseName}_predicted.csv`, Papa.unparse(toEnrichedRecords(rows)))}>
                <Download /> CSV + prediksi
              </Button>
              <Button size="sm" disabled={!rows.length} onClick={() => downloadText(`${baseName}_report.json`, report(), "application/json")}>
                <Braces /> JSON
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={!rows.length}
                aria-label="Salin ringkasan JSON"
                onClick={async () => {
                  if (await copyText(JSON.stringify({ model_version: MODEL_VERSION, file: file?.name, summary }, null, 2))) {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1600);
                  }
                }}
              >
                {copied ? <Check className="text-ok" /> : <ClipboardCopy />} {copied ? "Tersalin" : "Salin ringkasan"}
              </Button>
            </div>
          </div>

          <div className="p-4">
            <AnimatePresence mode="wait" initial={false}>
              {pipe.predict === "run" ? (
                <motion.div key="loading" {...fadeUp} className="space-y-2" aria-busy>
                  <Skeleton className="h-8 w-64" />
                  {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-9 w-full" />)}
                </motion.div>
              ) : rows.length === 0 ? (
                <motion.div key="empty" {...fadeUp} className="flex min-h-[400px] flex-col items-center justify-center text-center">
                  <div className="relative mb-4 grid grid-cols-6 gap-1 opacity-60" aria-hidden>
                    {Array.from({ length: 24 }, (_, i) => (
                      <span key={i} className="size-5 rounded-sm" style={{ background: `rgb(${i % 3 === 0 ? "0 242 254" : "99 102 241"} / ${0.06 + ((i * 7) % 10) / 60})` }} />
                    ))}
                  </div>
                  <h4 className="text-[15px] font-semibold text-ink">Belum ada batch</h4>
                  <p className="mt-1 max-w-sm text-[13px] text-muted">
                    Unggah batch rencana atau batch lampau. Tiap baris dihitung dengan model kinetika F441Y; prediksi, penanda, dan rendemen teramati muncul di sini.
                  </p>
                  <Button className="mt-4" variant="secondary" size="sm" onClick={loadSample}>Muat contoh batch</Button>
                </motion.div>
              ) : view === "table" ? (
                <motion.div key="table" {...fadeUp}>
                  <PredictionsTable rows={rows} onSimulate={onSimulate} />
                </motion.div>
              ) : (
                <motion.div key="overview" {...fadeUp}>
                  <BatchOverview rows={rows} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
