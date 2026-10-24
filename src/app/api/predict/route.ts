/**
 * POST /api/predict — CSV prediction + data-collection loop (signed-in users only).
 *
 * Body: { rows: RawRow[], fileName?: string, persist?: boolean }
 *  1. Verifies the session (the middleware already blocks anonymous calls).
 *  2. Re-maps and re-runs the mechanistic model on the server; the browser's
 *     preview is never trusted as the saved prediction.
 *  3. Matches every row to its nearest point in the hidden grid-search table
 *     (read server-side with the service role; the grid never leaves the server
 *     except as that single nearest match).
 *  4. Saves one upload_batches row + one prediction_logs row per input AS THE
 *     USER, so Row Level Security keeps each customer's history private.
 */
import { NextResponse } from "next/server";
import { mapRows, predictRows, MODEL_VERSION, type RawRow } from "@/lib/csv-predict";
import { getCurrentUser } from "@/lib/supabase/server";
import { getGrid, nearestGrid } from "@/server/grid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_ROWS = 2000;

export async function POST(req: Request) {
  const { db, user } = await getCurrentUser();
  if (!db || !user) return NextResponse.json({ error: "Silakan masuk terlebih dahulu" }, { status: 401 });

  let body: { rows?: RawRow[]; fileName?: string; persist?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Isi permintaan bukan JSON yang valid" }, { status: 400 });
  }
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (!rows.length) return NextResponse.json({ error: "Tidak ada baris yang dikirim" }, { status: 400 });
  if (rows.length > MAX_ROWS) return NextResponse.json({ error: `Maksimal ${MAX_ROWS} baris per unggahan` }, { status: 413 });

  const { inputs, errors, missingColumns } = mapRows(rows);
  if (missingColumns.length)
    return NextResponse.json({ error: `Kolom wajib tidak ada: ${missingColumns.join(", ")}` }, { status: 422 });

  const grid = await getGrid();
  const predictions = predictRows(inputs).map((p) => ({ ...p, ...nearestGrid(grid.points, p) }));

  if (body.persist === false) {
    return NextResponse.json({ predictions, errors, gridSource: grid.source, persisted: false, reason: "penyimpanan dimatikan" });
  }

  const { data: batch, error: batchErr } = await db
    .from("upload_batches")
    .insert({
      source: "csv_upload",
      file_name: body.fileName?.slice(0, 200) ?? null,
      row_count: predictions.length,
      model_version_id: MODEL_VERSION,
      uploaded_by: user.id,
    })
    .select("id")
    .single();
  if (batchErr) return NextResponse.json({ predictions, errors, gridSource: grid.source, persisted: false, reason: batchErr.message });

  const { error: logErr } = await db.from("prediction_logs").insert(
    predictions.map((p) => ({
      batch_id: batch.id,
      user_id: user.id,
      row_index: p.row_index,
      lactose_g_l: p.lactose_g_L,
      temperature_c: p.temperature_C,
      ph: p.pH,
      enzyme_u_ml: p.enzyme_U_mL,
      pred_peak_yield_pct: p.pred_peak_yield_pct,
      pred_harvest_h: p.pred_harvest_h,
      pred_gos_g_l: p.pred_gos_g_L,
      pred_productivity_g_l_h: p.pred_productivity_g_L_h,
      pred_enzyme_remaining_pct: p.pred_enzyme_remaining_pct,
      pred_loss_6h_pts: p.pred_loss_6h_pts,
      pred_loss_12h_pts: p.pred_loss_12h_pts,
      pred_loss_24h_pts: p.pred_loss_24h_pts,
      flags: p.flags,
      grid_lactose_g_l: p.grid_lactose_g_L ?? null,
      grid_temperature_c: p.grid_temperature_C ?? null,
      grid_ph: p.grid_pH ?? null,
      grid_yield_pct: p.grid_yield_pct ?? null,
      grid_distance: p.grid_distance ?? null,
      obs_yield_pct: p.obs_yield_pct,
      obs_harvest_h: p.obs_harvest_h,
      obs_gos_g_l: p.obs_gos_g_L,
      raw_row: p.raw,
    })),
  );
  if (logErr) return NextResponse.json({ predictions, errors, gridSource: grid.source, persisted: false, reason: logErr.message });

  return NextResponse.json({ predictions, errors, gridSource: grid.source, persisted: true, batchId: batch.id });
}

/** GET /api/predict — storage status for the sidebar badge (signed-in users only). */
export async function GET() {
  const { user } = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Silakan masuk terlebih dahulu" }, { status: 401 });
  return NextResponse.json({ supabase: true, modelVersion: MODEL_VERSION });
}
