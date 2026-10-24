# LacS·GOS Console — GenoHack 2026

Paid B2B decision dashboard for GOS prebiotic production with the β-galactosidase **LacS F441Y**
mutant (*S. solfataricus*, expressed in *P. pastoris*). Built for GenoHack 2026, hosted by SoluSEA Venture Lab.

Next.js 15 (App Router) · Tailwind CSS 4 · Radix/shadcn-style components · Recharts · PapaParse · Supabase (Auth + Postgres).

---

## What a signed-in customer gets

| Area | What it does |
|---|---|
| Simulation | Sliders for temperature, pH, lactose, enzyme dose. The kinetic model runs live in the browser. |
| Opportunity cost | Revenue lost when harvest is 6 / 12 / 24 h late, in **Rupiah**. Defaults: **Rp 80.000/kg GOS**, **1.000 L** batch (editable). |
| Operating window | Yield heatmap (lactose × temperature) and a live pH × temperature map. |
| CSV analysis | Upload planned/past batches → predictions, flags, nearest reference point, enriched CSV download. Saved to the customer's private history. |
| Model provenance | Mechanism, Wu 2013 / Sun 2014 validation, parameter origins, limitations. |

The 108-point grid search is **not** shown in the UI. It lives in the `grid_combinations`
table, readable only by the server (service role). `/api/predict` uses it to attach the single
nearest reference point to each uploaded row.

## Access control

- Every page and API route requires a Supabase Auth session (`src/middleware.ts`). Signed-out
  visitors are redirected to `/login`; API calls get `401`.
- No self sign-up. Accounts are created by an admin (see below).
- `profiles.is_active` is the paid-plan switch. Set it to `false` to lock a customer out
  without deleting their data.
- Row Level Security: customers read/write only their own `upload_batches` and
  `prediction_logs`; reference tables are readable by signed-in users only; the grid table
  has no policy at all.

---

## 1. Supabase setup (once per project)

1. Create a project at supabase.com.
2. **SQL Editor** → run `supabase/migrations/20261025000000_init.sql`, then `supabase/seed.sql`.
   (CLI alternative: `supabase link` → `supabase db push` → run the seed.) Both files are safe to re-run.
3. **Authentication → Providers → Email**: keep Email enabled, turn **"Allow new users to sign up" OFF**.
4. **Authentication → URL Configuration**: set *Site URL* to your Vercel domain and add
   `http://localhost:3000` to the redirect URLs.

## 2. Run locally

```bash
cp .env.example .env.local      # then fill in the three values
npm install
npm run dev                     # http://localhost:3000 → /login
```

Create the first customer account:

```bash
npm run create-user -- buyer@company.co.id "a-strong-password" "Budi Santoso" "PT Susu Nusantara"
```

Check the database (row counts + RLS):

```bash
npm run check-supabase
```

## 3. Push to GitHub

```bash
git init
git add .
git commit -m "LacS·GOS Console"
git branch -M main
git remote add origin https://github.com/<you>/genohack-dashboard.git
git push -u origin main
```

`.env.local` is git-ignored; only `.env.example` is committed.

## 4. Deploy on Vercel

1. vercel.com → **Add New Project** → import the GitHub repo. Framework is detected as Next.js;
   no build settings to change.
2. **Environment Variables**: add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY` (Production + Preview).
3. Deploy, then put the Vercel URL into Supabase *Site URL* (step 1.4).

---

## Project layout

```
src/
  middleware.ts               auth gate for every route
  app/
    page.tsx                  protected dashboard (server checks user + plan)
    login/                    email/password sign-in
    auth/signout/route.ts     POST sign-out
    api/predict/route.ts      CSV predictions + grid match + save to history
  components/dashboard/       UI (Indonesian)
  lib/
    kinetics.ts               5-species ODE model (port of gos/src/gos_kinetics.py)
    csv-predict.ts            CSV column mapping, predictions, enriched export
    supabase/                 browser / server (RLS, as the user) / admin (service role) clients
  server/
    grid.ts                   hidden grid lookup (server-only)
    data/grid.json            fallback copy of the grid, never sent to the browser
supabase/
  migrations/…_init.sql       schema, auth profiles, RLS, hidden grid
  seed.sql                    reference data generated from gos/hasil
  config.toml                 CLI auth settings (sign-up disabled)
scripts/
  ingest-data.mjs             gos/hasil → src/data + seed.sql   (npm run ingest)
  validate-model.mts          TS model vs SciPy outputs          (npm run validate-model)
  check-supabase.mjs          row counts + RLS checks            (npm run check-supabase)
  create-user.mjs             admin: create a customer account   (npm run create-user)
```

## The model

`src/lib/kinetics.ts` is a line-by-line port of `gos/src/gos_kinetics.py` with the F441Y parameters.
`npm run validate-model` compares it with the SciPy outputs: all 108 grid points agree within 0.0001
yield points, full curves within 0.03 points.

## Caveats

Model parameters are not yet fitted to experimental data (`kcat_gos`, `Km_gos`, `Ki_gal`, `Ea_cat`,
`Ea_sel` are set by the team; `kcat_gos` is not identifiable from current data). The 63.0% optimum
sits on the edge of the grid. Yields set the direction of experiments; they are not measurements.
The Rupiah figures are plant assumptions and can be edited on screen.
