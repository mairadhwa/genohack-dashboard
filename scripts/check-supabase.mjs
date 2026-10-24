/**
 * Check the Supabase setup without printing any keys.
 *
 *   npm run check-supabase          row counts for every table + latest upload batch
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and
 * SUPABASE_SERVICE_ROLE_KEY from .env.local (via node --env-file).
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const missing = Object.entries({ NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: anon, SUPABASE_SERVICE_ROLE_KEY: service })
  .filter(([, v]) => !v)
  .map(([k]) => k);
if (missing.length) {
  console.error(`Missing in .env.local: ${missing.join(", ")}`);
  process.exit(1);
}
console.log(`Project: ${new URL(url).host}`);

const db = createClient(url, service, { auth: { persistSession: false } });

const EXPECTED = {
  profiles: null,
  model_versions: 2,
  grid_combinations: 108,
  yield_map: 33,
  harvest_scenarios: 4,
  validation_benchmarks: 3,
  literature_dataset: 12,
  upload_batches: null,
  prediction_logs: null,
};

let ok = true;
for (const [table, want] of Object.entries(EXPECTED)) {
  const { count, error } = await db.from(table).select("*", { count: "exact", head: true });
  if (error) {
    ok = false;
    console.log(`  ✗ ${table.padEnd(22)} ${error.message}`);
  } else {
    const good = want === null || count === want;
    if (!good) ok = false;
    console.log(`  ${good ? "✓" : "✗"} ${table.padEnd(22)} ${count} rows${want !== null && !good ? ` (expected ${want})` : ""}`);
  }
}

// RLS checks with the public (anon) key: none of these may return rows.
const pub = createClient(url, anon, { auth: { persistSession: false } });
for (const t of ["grid_combinations", "prediction_logs", "upload_batches", "model_accuracy", "yield_map"]) {
  const { data } = await pub.from(t).select("*").limit(1);
  const hidden = !data?.length;
  if (!hidden) ok = false;
  console.log(`  ${hidden ? "✓" : "✗"} anon cannot read ${t.padEnd(18)} ${hidden ? "" : "(RLS problem!)"}`);
}

const { data: batch } = await db.from("upload_batches").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle();
if (batch) {
  const { data: logs } = await db
    .from("prediction_logs")
    .select("row_index, lactose_g_l, temperature_c, ph, enzyme_u_ml, pred_peak_yield_pct, pred_harvest_h, obs_yield_pct, yield_residual_pts, flags")
    .eq("batch_id", batch.id)
    .order("row_index");
  console.log(`\nLatest batch ${batch.id.slice(0, 8)} · ${batch.file_name} · ${batch.row_count} rows · ${batch.created_at}`);
  console.table(
    logs.map((l) => ({
      row: l.row_index + 1,
      lactose: l.lactose_g_l,
      T: l.temperature_c,
      pH: l.ph,
      U_mL: l.enzyme_u_ml,
      pred_yield: l.pred_peak_yield_pct.toFixed(2),
      harvest_h: l.pred_harvest_h.toFixed(1),
      observed: l.obs_yield_pct ?? "",
      residual: l.yield_residual_pts?.toFixed(2) ?? "",
      flags: l.flags.join("|"),
    })),
  );
  const { data: acc } = await db.from("model_accuracy").select("*");
  if (acc?.length) console.log("model_accuracy:", acc);
} else {
  console.log("\nNo upload batches yet.");
}

process.exit(ok ? 0 : 1);
