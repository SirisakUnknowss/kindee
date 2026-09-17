-- KinDee roadmap foundations: ownership, complete RLS, entitlements, and atomic sync.

create table if not exists public.installations (
  installation_id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  claimed_at timestamptz not null default now(),
  unique (user_id, installation_id)
);

create table if not exists public.entitlements (
  user_id uuid primary key references auth.users on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'premium')),
  status text not null default 'active' check (status in ('active', 'trialing', 'past_due', 'cancelled')),
  provider_customer_id text,
  period_end timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.usage_counters (
  user_id uuid not null references auth.users on delete cascade,
  feature text not null,
  period_start date not null,
  count integer not null default 0 check (count >= 0),
  primary key (user_id, feature, period_start)
);

create table if not exists public.food_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  food_id uuid not null references public.foods on delete cascade,
  reason text not null check (char_length(reason) between 3 and 1000),
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.photo_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  image_hash text not null check (image_hash ~ '^[0-9a-f]{64}$'),
  candidates jsonb,
  status text not null default 'processing' check (status in ('processing', 'complete', 'failed')),
  cost_cents numeric(10,4),
  created_at timestamptz not null default now(),
  unique (user_id, image_hash)
);

alter table public.food_portions enable row level security;
alter table public.installations enable row level security;
alter table public.entitlements enable row level security;
alter table public.usage_counters enable row level security;
alter table public.food_reports enable row level security;
alter table public.photo_jobs enable row level security;

drop policy if exists "write_own_food" on public.foods;
create policy "insert_own_private_food" on public.foods for insert to authenticated
  with check ((select auth.uid()) = contributed_by and source = 'user' and is_public = false);
create policy "update_own_private_food" on public.foods for update to authenticated
  using ((select auth.uid()) = contributed_by and source = 'user')
  with check ((select auth.uid()) = contributed_by and source = 'user');

create policy "read_food_portions" on public.food_portions for select
  using (exists (
    select 1 from public.foods f
    where f.id = food_id and (f.is_public or f.contributed_by = (select auth.uid()))
  ));
create policy "write_own_food_portions" on public.food_portions for all to authenticated
  using (exists (select 1 from public.foods f where f.id = food_id and f.contributed_by = (select auth.uid())))
  with check (exists (select 1 from public.foods f where f.id = food_id and f.contributed_by = (select auth.uid())));

create policy "own_installation" on public.installations for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "read_own_entitlement" on public.entitlements for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "read_own_usage" on public.usage_counters for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "own_food_reports" on public.food_reports for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "create_own_food_reports" on public.food_reports for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "read_own_photo_jobs" on public.photo_jobs for select to authenticated
  using ((select auth.uid()) = user_id);

-- Tighten existing ownership policies and make their target role explicit.
drop policy if exists "own_profile" on public.profiles;
create policy "own_profile" on public.profiles for all to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
drop policy if exists "own_weight_logs" on public.weight_logs;
create policy "own_weight_logs" on public.weight_logs for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "own_entries" on public.entries;
create policy "own_entries" on public.entries for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "own_daily_summaries" on public.daily_summaries;
create policy "own_daily_summaries" on public.daily_summaries for select to authenticated
  using ((select auth.uid()) = user_id);

revoke execute on function public.bump_daily_summary() from public, anon, authenticated;
alter function public.bump_daily_summary() set search_path = '';

create or replace function public.sync_entries(
  p_installation_id uuid,
  p_ops jsonb,
  p_since timestamptz default null
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_now timestamptz := statement_timestamp();
  v_op jsonb;
  v_payload jsonb;
  v_client_id text;
  v_applied text[] := '{}';
  v_owner uuid;
  v_changes jsonb;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if jsonb_typeof(p_ops) <> 'array' or jsonb_array_length(p_ops) > 200 then
    raise exception 'invalid sync batch';
  end if;

  select i.user_id into v_owner from public.installations i
  where i.installation_id = p_installation_id;
  if v_owner is not null and v_owner <> v_user then
    raise exception 'installation already claimed';
  end if;
  insert into public.installations (installation_id, user_id)
  values (p_installation_id, v_user) on conflict (installation_id) do nothing;

  for v_op in select value from jsonb_array_elements(p_ops)
  loop
    v_payload := v_op -> 'payload';
    v_client_id := v_op ->> 'client_id';
    insert into public.entries (
      user_id, client_id, food_id, portion_id, qty, grams, meal, eaten_at, eaten_on,
      food_name, kcal, protein, carb, fat, entry_source, deleted_at, updated_at
    ) values (
      v_user,
      v_client_id,
      case when coalesce(v_payload->>'food_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then (v_payload->>'food_id')::uuid else null end,
      case when coalesce(v_payload->>'portion_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then (v_payload->>'portion_id')::uuid else null end,
      (v_payload->>'qty')::numeric,
      nullif(v_payload->>'grams', '')::numeric,
      v_payload->>'meal',
      (v_payload->>'eaten_at')::timestamptz,
      (v_payload->>'eaten_on')::date,
      v_payload->>'food_name',
      (v_payload->>'kcal')::numeric,
      nullif(v_payload->>'protein', '')::numeric,
      nullif(v_payload->>'carb', '')::numeric,
      nullif(v_payload->>'fat', '')::numeric,
      v_payload->>'entry_source',
      nullif(v_payload->>'deleted_at', '')::timestamptz,
      (v_payload->>'updated_at')::timestamptz
    )
    on conflict (user_id, client_id) do update set
      food_id = excluded.food_id, portion_id = excluded.portion_id, qty = excluded.qty,
      grams = excluded.grams, meal = excluded.meal, eaten_at = excluded.eaten_at,
      eaten_on = excluded.eaten_on, food_name = excluded.food_name, kcal = excluded.kcal,
      protein = excluded.protein, carb = excluded.carb, fat = excluded.fat,
      entry_source = excluded.entry_source, deleted_at = excluded.deleted_at,
      updated_at = excluded.updated_at
    where public.entries.updated_at <= excluded.updated_at;
    v_applied := array_append(v_applied, v_client_id);
  end loop;

  select coalesce(jsonb_agg(to_jsonb(e) - 'id' - 'user_id' - 'created_at'), '[]'::jsonb)
  into v_changes from public.entries e
  where e.user_id = v_user and (p_since is null or e.updated_at > p_since);

  return jsonb_build_object('applied', to_jsonb(v_applied), 'changes', v_changes, 'now', v_now);
end;
$$;

revoke execute on function public.sync_entries(uuid, jsonb, timestamptz) from public, anon;
grant execute on function public.sync_entries(uuid, jsonb, timestamptz) to authenticated;

grant select, insert, update on public.profiles, public.weight_logs, public.entries, public.foods,
  public.food_portions, public.installations, public.food_reports to authenticated;
grant select on public.daily_summaries, public.entitlements, public.usage_counters to authenticated;
grant select on public.photo_jobs to authenticated;
grant select on public.foods, public.food_portions to anon;

create or replace function public.normalize_thai(value text) returns text
language sql immutable strict parallel safe
set search_path = ''
as $$
  select replace(
    replace(
      replace(
        replace(
          replace(
            replace(
              replace(
                replace(
                  replace(
                    replace(
                      regexp_replace(lower(normalize(value, NFC)), '[็่้๊๋์[:space:][:punct:]]', '', 'g'),
                      'ำ', 'าม'
                    ),
                    'ใ', 'ไ'
                  ),
                  'ฤ', 'ริ'
                ),
                'ทร', 'ซ'
              ),
              'ณ', 'น'
            ),
            'ญ', 'ย'
          ),
          'ฏ', 'ต'
        ),
        'ฬ', 'ล'
      ),
      'กระเพรา', 'กะเพรา'
    ),
    'กระเพา', 'กะเพรา'
  )
$$;

create or replace function public.search_foods(q text, cat text default null, lim integer default 30)
returns setof public.foods
language sql stable security invoker
set search_path = ''
as $$
  with nq as (select public.normalize_thai(q) as term)
  select f from public.foods f cross join nq
  where (cat is null or f.category = cat)
    and (f.search_text operator(extensions.%) nq.term or f.search_text like '%' || nq.term || '%')
  order by
    (f.search_text = nq.term) desc,
    (f.search_text like nq.term || '%') desc,
    (f.quality = 'verified') desc,
    f.popularity desc,
    extensions.similarity(f.search_text, nq.term) desc
  limit greatest(1, least(lim, 50))
$$;

revoke execute on function public.normalize_thai(text) from public;
grant execute on function public.normalize_thai(text) to anon, authenticated;
revoke execute on function public.search_foods(text, text, integer) from public;
grant execute on function public.search_foods(text, text, integer) to anon, authenticated;

create or replace function public.set_food_search_text() returns trigger
language plpgsql security invoker
set search_path = ''
as $$
begin
  new.search_text := public.normalize_thai(
    concat_ws(' ', new.name_th, new.name_en, new.brand, array_to_string(new.aliases, ' '))
  );
  return new;
end;
$$;
revoke execute on function public.set_food_search_text() from public, anon, authenticated;
drop trigger if exists foods_search_text on public.foods;
create trigger foods_search_text before insert or update of name_th, name_en, brand, aliases
on public.foods for each row execute function public.set_food_search_text();
update public.foods set search_text = public.normalize_thai(
  concat_ws(' ', name_th, name_en, brand, array_to_string(aliases, ' '))
);
