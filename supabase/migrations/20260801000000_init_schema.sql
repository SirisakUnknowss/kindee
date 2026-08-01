-- ── 0. Extensions ───────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";

-- ── 1. Profiles (โปรไฟล์ผู้ใช้) ──────────────────────────────────
create table if not exists public.profiles (
  id            uuid primary key references auth.users on delete cascade,
  display_name  text,
  sex           text not null check (sex in ('male','female')),
  birth_date    date not null,
  height_cm     numeric(5,1) not null check (height_cm between 100 and 250),
  activity      text not null check (activity in ('sedentary','light','moderate','active')),
  goal          text not null check (goal in ('lose','keep','gain')),
  target_kcal   int  not null check (target_kcal between 800 and 6000),
  target_source text not null default 'auto' check (target_source in ('auto','manual')),
  show_macros   boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── 2. Weight Logs (บันทึกน้ำหนัก) ─────────────────────────────
create table if not exists public.weight_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  weight_kg  numeric(5,1) not null check (weight_kg between 20 and 400),
  logged_on  date not null,
  created_at timestamptz not null default now(),
  unique (user_id, logged_on)
);

-- ── 3. Foods (คลังอาหาร & AI Cache) ────────────────────────────
create table if not exists public.foods (
  id               uuid primary key default gen_random_uuid(),
  name_th          text not null,
  name_en          text,
  aliases          text[] not null default '{}',
  brand            text,
  barcode          text unique,
  category         text,
  is_dish          boolean not null default false,
  is_packaged      boolean not null default false,
  kcal_100g        numeric(8,2) not null,
  protein_100g     numeric(8,2),
  carb_100g        numeric(8,2),
  fat_100g         numeric(8,2),
  package_size_g   numeric(8,2),
  serving_size_g   numeric(8,2),
  servings_per_pkg numeric(6,2),
  image_url        text,
  label_image_url  text,
  source           text not null default 'curated' check (source in ('off','usda','inmu','curated','user','ai')),
  source_id        text,
  source_updated   timestamptz,
  quality          text not null default 'unverified' check (quality in ('verified','community','unverified','incomplete')),
  confirm_count    int not null default 0,
  region           text default 'TH',
  contributed_by   uuid references auth.users on delete set null,
  is_public        boolean not null default true,
  search_text      text not null,
  popularity       int not null default 0,
  created_at       timestamptz not null default now()
);

create table if not exists public.food_portions (
  id          uuid primary key default gen_random_uuid(),
  food_id     uuid not null references public.foods on delete cascade,
  label_th    text not null,
  grams       numeric(8,2) not null,
  is_default  boolean not null default false,
  sort_order  int not null default 0
);

-- Index สำหรับค้นหาภาษาไทย Fuzzy & Barcode
create index if not exists foods_search_trgm on public.foods using gin (search_text gin_trgm_ops);
create index if not exists foods_barcode on public.foods (barcode) where barcode is not null;
create index if not exists foods_region_pkg on public.foods (region, is_packaged);

-- ── 4. Entries (รายการที่กิน) ──────────────────────────────────
create table if not exists public.entries (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  client_id    text not null,
  food_id      uuid references public.foods on delete set null,
  portion_id   uuid references public.food_portions on delete set null,
  qty          numeric(6,2) not null default 1,
  grams        numeric(8,2),
  meal         text not null check (meal in ('breakfast','lunch','dinner','snack')),
  eaten_at     timestamptz not null,
  eaten_on     date not null,
  food_name    text not null,
  kcal         numeric(8,2) not null,
  protein      numeric(8,2),
  carb         numeric(8,2),
  fat          numeric(8,2),
  entry_source text not null check (entry_source in ('search','recent','barcode','photo','manual')),
  deleted_at   timestamptz,
  updated_at   timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  unique (user_id, client_id)
);

create index if not exists entries_user_eaten_on on public.entries (user_id, eaten_on desc) where deleted_at is null;
create index if not exists entries_user_updated on public.entries (user_id, updated_at desc);

-- ── 5. Daily Summaries (สรุปรายวัน) ────────────────────────────
create table if not exists public.daily_summaries (
  user_id     uuid not null references auth.users on delete cascade,
  date        date not null,
  kcal        numeric(10,2) not null default 0,
  protein     numeric(10,2) not null default 0,
  carb        numeric(10,2) not null default 0,
  fat         numeric(10,2) not null default 0,
  entry_count int not null default 0,
  target_kcal int,
  primary key (user_id, date)
);

-- ── 6. Trigger สรุปรายวัน ────────────────────────────────────
create or replace function bump_daily_summary() returns trigger
language plpgsql security definer as $$
declare
  target_user uuid := coalesce(new.user_id, old.user_id);
  target_date date := coalesce(new.eaten_on, old.eaten_on);
  prev_date   date := old.eaten_on;
begin
  -- คำนวณวันหลัก (target_date)
  insert into public.daily_summaries (user_id, date, kcal, protein, carb, fat, entry_count)
  select target_user, target_date,
         coalesce(sum(kcal),0), coalesce(sum(protein),0),
         coalesce(sum(carb),0), coalesce(sum(fat),0), count(*)
  from public.entries
  where user_id = target_user and eaten_on = target_date and deleted_at is null
  on conflict (user_id, date) do update set
    kcal = excluded.kcal, protein = excluded.protein, carb = excluded.carb,
    fat = excluded.fat, entry_count = excluded.entry_count;

  -- ถ้าเป็นการ UPDATE ที่เปลี่ยนวัน (eaten_on เปลี่ยน) ต้องคำนวณวันเก่า (prev_date) ด้วย
  if (TG_OP = 'UPDATE' and prev_date is not null and prev_date <> target_date) then
    insert into public.daily_summaries (user_id, date, kcal, protein, carb, fat, entry_count)
    select target_user, prev_date,
           coalesce(sum(kcal),0), coalesce(sum(protein),0),
           coalesce(sum(carb),0), coalesce(sum(fat),0), count(*)
    from public.entries
    where user_id = target_user and eaten_on = prev_date and deleted_at is null
    on conflict (user_id, date) do update set
      kcal = excluded.kcal, protein = excluded.protein, carb = excluded.carb,
      fat = excluded.fat, entry_count = excluded.entry_count;
  end if;

  return null;
end $$;

drop trigger if exists entries_summary on public.entries;
create trigger entries_summary
after insert or update or delete on public.entries
for each row execute function bump_daily_summary();

-- ── 7. RLS (Row Level Security) ─────────────────────────────
alter table public.profiles        enable row level security;
alter table public.weight_logs     enable row level security;
alter table public.entries         enable row level security;
alter table public.daily_summaries enable row level security;
alter table public.foods           enable row level security;

-- Policies สำหรับ Profiles
drop policy if exists "own_profile" on public.profiles;
create policy "own_profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- Policies สำหรับ Weight Logs
drop policy if exists "own_weight_logs" on public.weight_logs;
create policy "own_weight_logs" on public.weight_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Policies สำหรับ Entries
drop policy if exists "own_entries" on public.entries;
create policy "own_entries" on public.entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Policies สำหรับ Daily Summaries
drop policy if exists "own_daily_summaries" on public.daily_summaries;
create policy "own_daily_summaries" on public.daily_summaries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Policies สำหรับ Foods (ทุกคนอ่านได้, User เพิ่มของตัวเองได้, Service role จัดการได้หมด)
drop policy if exists "read_foods" on public.foods;
create policy "read_foods" on public.foods for select using (is_public = true or auth.uid() = contributed_by);

drop policy if exists "write_own_food" on public.foods;
create policy "write_own_food" on public.foods for insert
  with check (auth.uid() = contributed_by or source in ('user','ai'));
