/**
 * CSV <-> model mapping. Shared by the browser (preview + download) and
 * /api/predict (authoritative recompute before saving to Supabase).
 */
import { flagsFor, predict, type Conditions } from "./kinetics";

/** Accepted header aliases (English, Indonesian from gos/hasil, and short forms). */
const ALIASES: Record<keyof Conditions | "obs_yield_pct" | "obs_harvest_h" | "obs_gos_g_L", string[]> = {
  lactose_g_L: ["lactose_g_l", "lactose", "laktosa_g_l", "laktosa", "laktosa_awal_g_l", "lactose_gl"],
  temperature_C: ["temperature_c", "temperature", "temp_c", "temp", "suhu_c", "suhu", "t_c"],
  pH: ["ph"],
  enzyme_U_mL: ["enzyme_u_ml", "enzyme", "enzim_u_ml", "enzim", "dose_u_ml", "dosis_enzim", "u_ml"],
  obs_yield_pct: ["observed_yield_pct", "obs_yield_pct", "actual_yield_pct", "rendemen_aktual_pct"],
  obs_harvest_h: ["observed_harvest_h", "obs_harvest_h", "actual_harvest_h", "waktu_aktual_h"],
  obs_gos_g_L: ["observed_gos_g_l", "obs_gos_g_l", "actual_gos_g_l", "gos_aktual_g_l"],
};

const norm = (h: string) => h.trim().toLowerCase().replace(/[\s/()°%-]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");

export type RawRow = Record<string, unknown>;

export interface InputRow extends Conditions {
  row_index: number;
  obs_yield_pct: number | null;
  obs_harvest_h: number | null;
  obs_gos_g_L: number | null;
  raw: RawRow;
}

export interface PredictedRow extends InputRow {
  pred_peak_yield_pct: number;
  pred_harvest_h: number;
  pred_gos_g_L: number;
  pred_productivity_g_L_h: number;
  pred_enzyme_remaining_pct: number;
  pred_loss_6h_pts: number;
  pred_loss_12h_pts: number;
  pred_loss_24h_pts: number;
  flags: string[];
  /** Nearest point of the hidden grid search, filled in by /api/predict (server only). */
  grid_lactose_g_L?: number;
  grid_temperature_C?: number;
  grid_pH?: number;
  grid_yield_pct?: number;
  grid_harvest_h?: number;
  grid_distance?: number;
  grid_exact?: boolean;
}

export interface RowError {
  row_index: number;
  message: string;
}

export const DEFAULT_ENZYME_U_ML = 9;

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

export type ModelField = keyof typeof ALIASES;

export const FIELD_INFO: { field: ModelField; label: string; required: boolean; fallback?: string }[] = [
  { field: "lactose_g_L", label: "Laktosa (g/L)", required: true },
  { field: "temperature_C", label: "Suhu (°C)", required: true },
  { field: "pH", label: "pH", required: true },
  { field: "enzyme_U_mL", label: "Enzim (U/mL)", required: false, fallback: "bawaan 9" },
  { field: "obs_yield_pct", label: "Rendemen teramati (%)", required: false },
  { field: "obs_harvest_h", label: "Panen teramati (jam)", required: false },
  { field: "obs_gos_g_L", label: "GOS teramati (g/L)", required: false },
];

/** Which CSV header feeds each model field (undefined = not found). */
export function detectColumns(headers: string[]): Partial<Record<ModelField, string>> {
  const col: Partial<Record<ModelField, string>> = {};
  for (const [key, aliases] of Object.entries(ALIASES) as [ModelField, string[]][]) {
    const hit = headers.find((h) => norm(h) === norm(key) || aliases.includes(norm(h)));
    if (hit) col[key] = hit;
  }
  return col;
}

/** Map raw CSV rows (any header style) to validated model inputs. */
export function mapRows(rows: RawRow[]): { inputs: InputRow[]; errors: RowError[]; missingColumns: string[] } {
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const col = detectColumns(headers);
  const missingColumns = (["lactose_g_L", "temperature_C", "pH"] as const).filter((k) => !col[k]);
  if (missingColumns.length) return { inputs: [], errors: [], missingColumns };

  const inputs: InputRow[] = [];
  const errors: RowError[] = [];
  rows.forEach((raw, i) => {
    const lac = num(raw[col.lactose_g_L!]);
    const T = num(raw[col.temperature_C!]);
    const pH = num(raw[col.pH!]);
    const E = col.enzyme_U_mL ? num(raw[col.enzyme_U_mL]) ?? DEFAULT_ENZYME_U_ML : DEFAULT_ENZYME_U_ML;
    if (lac === null || T === null || pH === null) return errors.push({ row_index: i, message: "Laktosa / suhu / pH kosong atau bukan angka" });
    if (lac <= 0 || lac > 1200) return errors.push({ row_index: i, message: `Laktosa ${lac} g/L di luar rentang fisik (0–1200)` });
    if (T < 20 || T > 100) return errors.push({ row_index: i, message: `Suhu ${T} °C di luar rentang (20–100)` });
    if (pH < 3 || pH > 9) return errors.push({ row_index: i, message: `pH ${pH} di luar rentang (3–9)` });
    if (E <= 0 || E > 100) return errors.push({ row_index: i, message: `Enzim ${E} U/mL di luar rentang (0–100)` });
    inputs.push({
      row_index: i,
      lactose_g_L: lac,
      temperature_C: T,
      pH,
      enzyme_U_mL: E,
      obs_yield_pct: col.obs_yield_pct ? num(raw[col.obs_yield_pct]) : null,
      obs_harvest_h: col.obs_harvest_h ? num(raw[col.obs_harvest_h]) : null,
      obs_gos_g_L: col.obs_gos_g_L ? num(raw[col.obs_gos_g_L]) : null,
      raw,
    });
  });
  return { inputs, errors, missingColumns };
}

/** Run the mechanistic model for each input row. */
export function predictRow(r: InputRow): PredictedRow {
  const s = predict(r).summary;
  return {
    ...r,
    pred_peak_yield_pct: s.peak_yield_pct,
    pred_harvest_h: s.peak_time_h,
    pred_gos_g_L: s.peak_gos_g_L,
    pred_productivity_g_L_h: s.productivity_g_L_h,
    pred_enzyme_remaining_pct: s.enzyme_remaining_pct,
    pred_loss_6h_pts: s.loss_pts[6],
    pred_loss_12h_pts: s.loss_pts[12],
    pred_loss_24h_pts: s.loss_pts[24],
    flags: flagsFor(r),
  };
}

export function predictRows(inputs: InputRow[]): PredictedRow[] {
  return inputs.map(predictRow);
}

/** Batch-level summary used by the workspace and the JSON report. */
export function summarizeBatch(rows: PredictedRow[]) {
  if (!rows.length) return null;
  const best = rows.reduce((a, r) => (r.pred_peak_yield_pct > a.pred_peak_yield_pct ? r : a));
  const observed = rows.filter((r) => r.obs_yield_pct !== null);
  const resid = observed.map((r) => r.obs_yield_pct! - r.pred_peak_yield_pct);
  return {
    rows: rows.length,
    mean_yield_pct: rows.reduce((a, r) => a + r.pred_peak_yield_pct, 0) / rows.length,
    mean_harvest_h: rows.reduce((a, r) => a + r.pred_harvest_h, 0) / rows.length,
    best_row: best.row_index + 1,
    best_yield_pct: best.pred_peak_yield_pct,
    flagged_rows: rows.filter((r) => r.flags.length).length,
    observed_rows: observed.length,
    bias_pts: resid.length ? resid.reduce((a, b) => a + b, 0) / resid.length : null,
    rmse_pts: resid.length ? Math.sqrt(resid.reduce((a, b) => a + b * b, 0) / resid.length) : null,
  };
}

/** Flatten for download: original columns first, predictions appended. */
export function toEnrichedRecords(rows: PredictedRow[]) {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return rows.map((r) => ({
    ...r.raw,
    pred_peak_yield_pct: r2(r.pred_peak_yield_pct),
    pred_harvest_h: r2(r.pred_harvest_h),
    pred_gos_g_L: r2(r.pred_gos_g_L),
    pred_productivity_g_L_h: r2(r.pred_productivity_g_L_h),
    pred_enzyme_remaining_pct: r2(r.pred_enzyme_remaining_pct),
    pred_loss_6h_pts: r2(r.pred_loss_6h_pts),
    pred_loss_12h_pts: r2(r.pred_loss_12h_pts),
    pred_loss_24h_pts: r2(r.pred_loss_24h_pts),
    yield_residual_pts: r.obs_yield_pct !== null ? r2(r.obs_yield_pct - r.pred_peak_yield_pct) : "",
    grid_match: r.grid_yield_pct !== undefined ? `${r.grid_lactose_g_L}/${r.grid_temperature_C}/${r.grid_pH}` : "",
    grid_yield_pct: r.grid_yield_pct !== undefined ? r2(r.grid_yield_pct) : "",
    grid_exact: r.grid_exact === undefined ? "" : r.grid_exact ? "yes" : "no",
    flags: r.flags.join("|"),
    model_version: MODEL_VERSION,
  }));
}

export const MODEL_VERSION = "F441Y-2026-10-24";

export const TEMPLATE_CSV = `batch_id,lactose_g_L,temperature_C,pH,enzyme_U_mL,observed_yield_pct
B-001,800,85,6.0,9,
B-002,700,75,6.0,9,60.4
B-003,600,80,5.5,9,
B-004,500,70,6.0,6,
B-005,700,80,6.5,12,
B-006,450,65,5.0,9,
`;
