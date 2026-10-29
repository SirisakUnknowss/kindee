-- Water and exercise logs, plus an opt-in monthly leaderboard.
-- Clients are offline-first (Dexie) and write these rows straight to Supabase like
-- body_measurements; RLS keeps every row private to its owner.

create table if not exists public.water_logs (
  user_id    uuid not null references auth.users on delete cascade,
  logged_on  date not null,
  ml         integer not null check (ml between 0 and 10000),
  updated_at timestamptz not null default now(),
  primary key (user_id, logged_on)
);

alter table public.water_logs enable row level security;
drop policy if exists "own_water_logs" on public.water_logs;
create policy "own_water_logs" on public.water_logs for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.water_logs from anon;
grant select, insert, update, delete on public.water_logs to authenticated;

-- id is the client-generated UUID so offline edits upsert onto the same row.
create table if not exists public.exercise_logs (
  id         uuid primary key,
  user_id    uuid not null references auth.users on delete cascade,
  done_on    date not null,
  name       text not null check (char_length(btrim(name)) between 1 and 60),
  minutes    integer check (minutes between 1 and 1440),
  kcal       integer not null check (kcal between 0 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists exercise_logs_user_day on public.exercise_logs (user_id, done_on desc);

alter table public.exercise_logs enable row level security;
drop policy if exists "own_exercise_logs" on public.exercise_logs;
create policy "own_exercise_logs" on public.exercise_logs for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.exercise_logs from anon;
grant select, insert, update, delete on public.exercise_logs to authenticated;

-- Joining the leaderboard is opt-in. Other users only ever see the nickname and the
-- number of days logged this month — never food, calories or weight.
create table if not exists public.leaderboard_members (
  user_id      uuid primary key references auth.users on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 2 and 24),
  joined_at    timestamptz not null default now()
);

alter table public.leaderboard_members enable row level security;
drop policy if exists "own_leaderboard_member" on public.leaderboard_members;
create policy "own_leaderboard_member" on public.leaderboard_members for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.leaderboard_members from anon;
grant select, insert, update, delete on public.leaderboard_members to authenticated;

-- Top 50 by distinct logged days in the month (Asia/Bangkok), plus the caller's own row.
create or replace function public.monthly_leaderboard(p_month date default null)
returns table (rank bigint, display_name text, days bigint, is_me boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with bounds as (
    select date_trunc('month', coalesce(p_month, (now() at time zone 'Asia/Bangkok')::date))::date as m_start,
           (now() at time zone 'Asia/Bangkok')::date as today
  ),
  counts as (
    select m.user_id, m.display_name, m.joined_at, count(distinct e.eaten_on) as days
    from public.leaderboard_members m
    cross join bounds b
    join public.entries e
      on e.user_id = m.user_id
     and e.deleted_at is null
     and e.eaten_on >= b.m_start
     and e.eaten_on < (b.m_start + interval '1 month')::date
     and e.eaten_on <= b.today
    group by m.user_id, m.display_name, m.joined_at
  ),
  ranked as (
    select rank() over (order by days desc) as rank, display_name, days, joined_at,
           user_id = (select auth.uid()) as is_me
    from counts
  )
  select rank, display_name, days, is_me
  from ranked
  where rank <= 50 or is_me
  order by rank, joined_at
$$;

revoke all on function public.monthly_leaderboard(date) from public, anon;
grant execute on function public.monthly_leaderboard(date) to authenticated;
