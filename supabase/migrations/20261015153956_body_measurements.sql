-- Body measurement tracking (ติดตามรูปร่าง): one optional set of measurements per user and day.
-- Clients are offline-first and upsert on (user_id, measured_on); a missing measure is NULL, never 0.
-- Age is derived from profiles.birth_date, so it is not stored here. Weight also stays in
-- profiles/weight_logs for the TDEE target; this table is the measurement history.

create table if not exists public.body_measurements (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  measured_on date not null,
  weight_kg   numeric(5,1) check (weight_kg between 20 and 400),
  height_cm   numeric(4,1) check (height_cm between 80 and 250),
  shoulder_cm numeric(4,1) check (shoulder_cm between 50 and 200),
  chest_cm    numeric(4,1) check (chest_cm between 40 and 250),
  waist_cm    numeric(4,1) check (waist_cm between 30 and 250),
  hip_cm      numeric(4,1) check (hip_cm between 40 and 250),
  thigh_cm    numeric(4,1) check (thigh_cm between 20 and 150),
  calf_cm     numeric(4,1) check (calf_cm between 15 and 100),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, measured_on),
  constraint body_measurements_has_value check (num_nonnulls(
    weight_kg, height_cm, shoulder_cm, chest_cm, waist_cm, hip_cm, thigh_cm, calf_cm
  ) > 0)
);

alter table public.body_measurements enable row level security;

drop policy if exists "own_body_measurements" on public.body_measurements;
create policy "own_body_measurements" on public.body_measurements for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on public.body_measurements from anon;
grant select, insert, update, delete on public.body_measurements to authenticated;
