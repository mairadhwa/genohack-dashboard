-- =============================================================================
-- GenoHack 2026 · LacS·GOS Console — database schema (Supabase / PostgreSQL)
--
-- Safe to run more than once, and safe on top of the earlier supabase/schema.sql.
--
-- How to apply
--   • Supabase CLI:   supabase db push            (then: supabase db seed / psql -f supabase/seed.sql)
--   • Dashboard:      SQL Editor → paste this file → Run, then paste supabase/seed.sql → Run
--
-- Sections
--   A. Accounts        profiles (1:1 with auth.users) + paid-plan flag
--   B. Reference data  model versions, yield map, scenarios, validation, literature
--   C. Hidden grid     grid_combinations — server (service role) only
--   D. Upload history  upload_batches + prediction_logs, private per user
--   E. Views           upload history summary, model accuracy, refit dataset
--   F. Row Level Security
--
-- Auth settings that are NOT stored in SQL (set them in the Supabase dashboard,
-- or via supabase/config.toml when using the CLI):
--   Authentication → Providers → Email: enabled, "Allow new users to sign up" OFF
--   (paid B2B package: accounts are created by an admin, see README).
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- A. ACCOUNTS
-- -----------------------------------------------------------------------------

-- One profile per Supabase Auth user. is_active is the paid-plan switch:
-- set it to false to lock a customer out without deleting their history.
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  company     text,
  plan        text not null default 'b2b-standard',
  is_active   boolean not null default true,
  active_until date,
  created_at  timestamptz not null default now()
);

-- Create the profile automatically when an admin creates a user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, company)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'company'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for users that existed before this migration.
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- B. REFERENCE DATA (read-only for signed-in customers)
-- -----------------------------------------------------------------------------

create table if not exists public.model_versions (
  id                 text primary key,
  enzyme             text not null,
  params             jsonb not null,
  enzyme_mm_per_u_ml double precision not null,
  notes              text,
  created_at         timestamptz not null default now()
);

create table if not exists public.yield_map (
  id             bigint generated always as identity primary key,
  lactose_g_l    double precision not null,
  temperature_c  double precision not null,
  yield_pct      double precision not null,
  unique (lactose_g_l, temperature_c)
);

create table if not exists public.harvest_scenarios (
  scenario              text primary key,
  lactose_g_l           double precision,
  temperature_c         double precision,
  ph                    double precision,
  peak_yield_pct        double precision,
  peak_time_h           double precision,
  peak_gos_g_l          double precision,
  productivity_g_l_h    double precision,
  enzyme_remaining_pct  double precision,
  loss_6h_pts           double precision,
  loss_12h_pts          double precision,
  loss_24h_pts          double precision,
  note                  text
);

create table if not exists public.validation_benchmarks (
  id             bigint generated always as identity primary key,
  label          text not null unique,
  kind           text not null check (kind in ('calibration','anchor','independent','plant')),
  lactose_g_l    double precision,
  temperature_c  double precision,
  ph             double precision,
  enzyme_u_ml    double precision,
  predicted_pct  double precision,
  published_pct  double precision,
  rel_error_pct  double precision generated always as
                   (abs(predicted_pct - published_pct) / nullif(published_pct, 0) * 100) stored,
  source         text
);

create table if not exists public.literature_dataset (
  ref_id               text primary key,
  enzyme_source        text,
  substrate            text,
  lactose_g_l          double precision,
  temperature_c        double precision,
  ph                   double precision,
  yield_pct            double precision,
  reference            text,
  verification_status  text
);

-- -----------------------------------------------------------------------------
-- C. HIDDEN GRID (108 feasible grid-search combinations)
--    No RLS policy for anon/authenticated → invisible to customers, even via
--    the REST API. Only the service role (used by /api/predict on the server)
--    can read it, to map uploaded CSV rows to their nearest reference point.
-- -----------------------------------------------------------------------------

create table if not exists public.grid_combinations (
  id                   bigint generated always as identity primary key,
  model_version_id     text references public.model_versions(id) default 'F441Y-2026-10-24',
  lactose_g_l          double precision not null,
  temperature_c        double precision not null,
  ph                   double precision not null,
  yield_pct            double precision not null,
  harvest_h            double precision not null,
  gos_g_l              double precision not null,
  productivity_g_l_h   double precision not null,
  unique (model_version_id, lactose_g_l, temperature_c, ph)
);

-- -----------------------------------------------------------------------------
-- D. UPLOAD HISTORY (private per customer)
-- -----------------------------------------------------------------------------

create table if not exists public.upload_batches (
  id                uuid primary key default gen_random_uuid(),
  source            text not null default 'csv_upload'
                      check (source in ('csv_upload','simulator','api')),
  file_name         text,
  row_count         integer not null default 0,
  model_version_id  text references public.model_versions(id) default 'F441Y-2026-10-24',
  uploaded_by       uuid references auth.users(id) on delete cascade default auth.uid(),
  site              text,
  created_at        timestamptz not null default now()
);

-- Upgrade path from the earlier schema.sql (uploaded_by was optional there,
-- with "on delete set null", which conflicts with a required owner).
alter table public.upload_batches drop constraint if exists upload_batches_uploaded_by_fkey;
alter table public.upload_batches
  add constraint upload_batches_uploaded_by_fkey
  foreign key (uploaded_by) references auth.users(id) on delete cascade;
alter table public.upload_batches alter column uploaded_by set default auth.uid();
do $$
begin
  if not exists (select 1 from public.upload_batches where uploaded_by is null) then
    alter table public.upload_batches alter column uploaded_by set not null;
  end if;
end $$;

create table if not exists public.prediction_logs (
  id                        bigint generated always as identity primary key,
  batch_id                  uuid not null references public.upload_batches(id) on delete cascade,
  user_id                   uuid references auth.users(id) on delete cascade default auth.uid(),
  row_index                 integer,
  -- inputs
  lactose_g_l               double precision not null,
  temperature_c             double precision not null,
  ph                        double precision not null,
  enzyme_u_ml               double precision not null,
  -- model outputs
  pred_peak_yield_pct       double precision not null,
  pred_harvest_h            double precision not null,
  pred_gos_g_l              double precision not null,
  pred_productivity_g_l_h   double precision,
  pred_enzyme_remaining_pct double precision,
  pred_loss_6h_pts          double precision,
  pred_loss_12h_pts         double precision,
  pred_loss_24h_pts         double precision,
  flags                     text[] not null default '{}',
  -- nearest hidden-grid reference (single point, written by the server)
  grid_lactose_g_l          double precision,
  grid_temperature_c        double precision,
  grid_ph                   double precision,
  grid_yield_pct            double precision,
  grid_distance             double precision,
  -- optional plant measurements from the CSV
  obs_yield_pct             double precision,
  obs_harvest_h             double precision,
  obs_gos_g_l               double precision,
  yield_residual_pts        double precision generated always as (obs_yield_pct - pred_peak_yield_pct) stored,
  raw_row                   jsonb,
  created_at                timestamptz not null default now()
);

-- Upgrade path from the earlier schema.sql.
alter table public.prediction_logs add column if not exists user_id uuid references auth.users(id) on delete cascade default auth.uid();
alter table public.prediction_logs add column if not exists grid_lactose_g_l double precision;
alter table public.prediction_logs add column if not exists grid_temperature_c double precision;
alter table public.prediction_logs add column if not exists grid_ph double precision;
alter table public.prediction_logs add column if not exists grid_yield_pct double precision;
alter table public.prediction_logs add column if not exists grid_distance double precision;

create index if not exists upload_batches_user_idx on public.upload_batches(uploaded_by, created_at desc);
create index if not exists prediction_logs_batch_idx on public.prediction_logs(batch_id);
create index if not exists prediction_logs_user_idx on public.prediction_logs(user_id);
create index if not exists prediction_logs_observed_idx
  on public.prediction_logs(created_at) where obs_yield_pct is not null;

-- -----------------------------------------------------------------------------
-- E. VIEWS (security_invoker: each user only sees rows RLS allows them)
-- -----------------------------------------------------------------------------

-- One line per upload, for an "upload history" list.
create or replace view public.upload_history with (security_invoker = true) as
select
  b.id,
  b.file_name,
  b.row_count,
  b.created_at,
  b.model_version_id,
  avg(p.pred_peak_yield_pct)            as mean_pred_yield_pct,
  count(p.obs_yield_pct)                as observed_rows,
  sqrt(avg(p.yield_residual_pts ^ 2))   as rmse_pts
from public.upload_batches b
left join public.prediction_logs p on p.batch_id = b.id
group by b.id;

-- Accuracy of the model against plant data the user uploaded.
create or replace view public.model_accuracy with (security_invoker = true) as
select
  b.model_version_id,
  count(*)                                   as observed_points,
  avg(p.yield_residual_pts)                  as bias_pts,
  sqrt(avg(p.yield_residual_pts ^ 2))        as rmse_pts,
  avg(abs(p.yield_residual_pts) / nullif(p.obs_yield_pct, 0) * 100) as mape_pct,
  max(p.created_at)                          as last_observation
from public.prediction_logs p
join public.upload_batches b on b.id = p.batch_id
where p.obs_yield_pct is not null
group by b.model_version_id;

-- Observed points ready for refitting (feeds gos_kinetics.fit_parameters).
create or replace view public.refit_dataset with (security_invoker = true) as
select lactose_g_l, temperature_c, ph, enzyme_u_ml,
       obs_harvest_h as t_h, obs_gos_g_l as gos_g_l, obs_yield_pct, created_at
from public.prediction_logs
where obs_gos_g_l is not null or obs_yield_pct is not null;

-- -----------------------------------------------------------------------------
-- F. ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------

alter table public.profiles              enable row level security;
alter table public.model_versions        enable row level security;
alter table public.yield_map             enable row level security;
alter table public.harvest_scenarios     enable row level security;
alter table public.validation_benchmarks enable row level security;
alter table public.literature_dataset    enable row level security;
alter table public.grid_combinations     enable row level security;
alter table public.upload_batches        enable row level security;
alter table public.prediction_logs       enable row level security;

-- Profiles: users read their own; only admins (service role / dashboard) edit.
drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for select to authenticated using (id = auth.uid());

-- Reference data: signed-in customers only (the old "public read" is removed).
do $$
declare t text;
begin
  foreach t in array array['model_versions','yield_map','harvest_scenarios',
                           'validation_benchmarks','literature_dataset']
  loop
    execute format('drop policy if exists "public read" on public.%I', t);
    execute format('drop policy if exists "signed-in read" on public.%I', t);
    execute format('create policy "signed-in read" on public.%I for select to authenticated using (true)', t);
  end loop;
end $$;

-- Hidden grid: remove any old policy and all table privileges for API roles.
drop policy if exists "public read" on public.grid_combinations;
revoke all on public.grid_combinations from anon, authenticated;

-- Upload history: each customer sees and writes only their own rows.
drop policy if exists "auth read batches" on public.upload_batches;
drop policy if exists "own batches read" on public.upload_batches;
drop policy if exists "own batches insert" on public.upload_batches;
create policy "own batches read" on public.upload_batches
  for select to authenticated using (uploaded_by = auth.uid());
create policy "own batches insert" on public.upload_batches
  for insert to authenticated with check (uploaded_by = auth.uid());

drop policy if exists "auth read logs" on public.prediction_logs;
drop policy if exists "own logs read" on public.prediction_logs;
drop policy if exists "own logs insert" on public.prediction_logs;
create policy "own logs read" on public.prediction_logs
  for select to authenticated using (user_id = auth.uid());
create policy "own logs insert" on public.prediction_logs
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (select 1 from public.upload_batches b where b.id = batch_id and b.uploaded_by = auth.uid())
  );

-- Anonymous visitors get nothing from the history tables.
revoke all on public.upload_batches, public.prediction_logs from anon;

-- -----------------------------------------------------------------------------
-- Current model version (keep in sync with src/lib/kinetics.ts)
-- -----------------------------------------------------------------------------
insert into public.model_versions (id, enzyme, params, enzyme_mm_per_u_ml, notes) values
('F441Y-2026-10-24', 'LacS F441Y',
 '{"Km_lac":26.3,"Ki_gal":6.0,"kcat_lac":2.67,"kcat_gos":60.0,"Km_gos":220.0,"K_acc":18.904364002605156,
   "Ea_sel":26000.0,"pH_opt_sel":6.0,"pH_width_sel":1.4,"Ea_cat":48000.0,"Ea_deact":213000.0,
   "kd_ref":0.009627044174443685,"T_ref":353.15,"pH_opt":6.0,"pH_width":1.1}'::jsonb,
 0.000805035559802313,
 'Base fix 24 Oct 2026: pH_opt_sel 6.0, separate WT/F441Y sets. kcat_gos not identifiable.'),
('WT-2026-10-24', 'LacS WT',
 '{"Km_lac":26.3,"Ki_gal":6.0,"kcat_lac":2.67,"kcat_gos":60.0,"Km_gos":220.0,"K_acc":60.53439103802864,
   "Ea_sel":26000.0,"pH_opt_sel":6.0,"pH_width_sel":1.4,"Ea_cat":48000.0,"Ea_deact":213000.0,
   "kd_ref":0.009627044174443685,"T_ref":353.15,"pH_opt":6.0,"pH_width":1.1}'::jsonb,
 0.000805035559802313,
 'Calibrated to Park et al. 2008 (80 C, pH 6, 600 g/L, 3.6 U/mL).')
on conflict (id) do nothing;
