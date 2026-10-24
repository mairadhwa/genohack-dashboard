/**
 * Check the TypeScript ODE port against the SciPy reference trajectories
 * (gos/hasil/kurva_waktu_F441Y.csv) and the 108-point grid.
 *
 * Run: npm run validate-model     (Node >= 22.6, native TS type stripping)
 */
import fs from "node:fs";
import path from "node:path";
import { predict, simulate } from "../src/lib/kinetics.ts";

type RefRow = { kondisi: string; laktosa_awal_g_L: number; suhu_C: number; pH: number; t_h: number; rendemen_GOS_pct: number };
const here = import.meta.dirname;
const ref: RefRow[] = JSON.parse(fs.readFileSync(path.join(here, "reference-curves.json"), "utf8"));
const grid = JSON.parse(fs.readFileSync(path.join(here, "../src/server/data/grid.json"), "utf8"));

let worst = 0;
for (const name of [...new Set(ref.map((r) => r.kondisi))]) {
  const rows = ref.filter((r) => r.kondisi === name);
  const c = { lactose_g_L: rows[0].laktosa_awal_g_L, temperature_C: rows[0].suhu_C, pH: rows[0].pH, enzyme_U_mL: 9 };
  const traj = simulate(c, { tMax: 72, sampleEvery: 0.05 });
  let maxErr = 0;
  for (const r of rows) {
    const p = traj[Math.round(r.t_h / 0.05)];
    maxErr = Math.max(maxErr, Math.abs(p.yield_pct - r.rendemen_GOS_pct));
  }
  const s = predict(c).summary;
  worst = Math.max(worst, maxErr);
  console.log(`${name.padEnd(22)} peak ${s.peak_yield_pct.toFixed(2)}% @ ${s.peak_time_h.toFixed(1)} h   max |Δyield| = ${maxErr.toFixed(4)} pts`);
}

let gridErr = 0, timeErr = 0;
for (const g of grid) {
  const s = predict({ lactose_g_L: g.lactose_g_L, temperature_C: g.temperature_C, pH: g.pH, enzyme_U_mL: 9 }).summary;
  gridErr = Math.max(gridErr, Math.abs(s.peak_yield_pct - g.yield_pct));
  timeErr = Math.max(timeErr, Math.abs(s.peak_time_h - g.harvest_h));
}
console.log(`grid (108): max |Δpeak yield| = ${gridErr.toFixed(4)} pts, max |Δharvest| = ${timeErr.toFixed(2)} h`);
process.exit(worst < 0.05 && gridErr < 0.05 ? 0 : 1);
