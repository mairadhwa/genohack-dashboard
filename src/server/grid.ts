import "server-only";
import fallbackGrid from "./data/grid.json";
import { getAdminClient } from "@/lib/supabase/admin";
import type { Conditions } from "@/lib/kinetics";

/**
 * Hidden grid-search reference (108 feasible combinations).
 *
 * Source of truth is the Supabase table `grid_combinations`, which has no RLS
 * policy for anon/authenticated users — only this server module (service role)
 * can read it. If Supabase is unreachable, the bundled server-only copy is used.
 * Nothing in this file is ever sent to the browser in bulk; only the single
 * nearest match per CSV row is returned by /api/predict.
 */
export interface GridPoint {
  lactose_g_L: number;
  temperature_C: number;
  pH: number;
  yield_pct: number;
  harvest_h: number;
  gos_g_L: number;
}

export interface GridMatch {
  grid_lactose_g_L: number;
  grid_temperature_C: number;
  grid_pH: number;
  grid_yield_pct: number;
  grid_harvest_h: number;
  /** Normalised distance: 0 = exact grid point; 1 ≈ one grid step away on one axis. */
  grid_distance: number;
  grid_exact: boolean;
}

const TTL_MS = 10 * 60 * 1000;
let cache: { at: number; points: GridPoint[]; source: "supabase" | "bundled" } | null = null;

export async function getGrid() {
  if (cache && Date.now() - cache.at < TTL_MS) return cache;
  const db = getAdminClient();
  if (db) {
    const { data, error } = await db
      .from("grid_combinations")
      .select("lactose_g_l, temperature_c, ph, yield_pct, harvest_h, gos_g_l");
    if (!error && data?.length) {
      cache = {
        at: Date.now(),
        source: "supabase",
        points: data.map((r) => ({
          lactose_g_L: r.lactose_g_l,
          temperature_C: r.temperature_c,
          pH: r.ph,
          yield_pct: r.yield_pct,
          harvest_h: r.harvest_h,
          gos_g_L: r.gos_g_l,
        })),
      };
      return cache;
    }
  }
  cache = { at: Date.now(), source: "bundled", points: fallbackGrid as GridPoint[] };
  return cache;
}

/** Grid steps: 100 g/L lactose, 5 °C, 0.5 pH. */
const STEP = { lactose: 100, temperature: 5, pH: 0.5 };

export function nearestGrid(points: GridPoint[], c: Conditions): GridMatch | null {
  let best: GridPoint | null = null;
  let bestD = Infinity;
  for (const p of points) {
    const d = Math.hypot(
      (p.lactose_g_L - c.lactose_g_L) / STEP.lactose,
      (p.temperature_C - c.temperature_C) / STEP.temperature,
      (p.pH - c.pH) / STEP.pH,
    );
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  if (!best) return null;
  return {
    grid_lactose_g_L: best.lactose_g_L,
    grid_temperature_C: best.temperature_C,
    grid_pH: best.pH,
    grid_yield_pct: best.yield_pct,
    grid_harvest_h: best.harvest_h,
    grid_distance: bestD,
    grid_exact: bestD < 1e-6,
  };
}
