-- Preserve the user's own ledger labels and notes across devices.
alter table public.entries add column if not exists unit_label text;
alter table public.entries add column if not exists note text;

alter table public.entries drop constraint if exists entries_note_length;
alter table public.entries add constraint entries_note_length check (char_length(note) <= 240);

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
      food_name, unit_label, note, kcal, protein, carb, fat, entry_source, deleted_at, updated_at
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
      nullif(v_payload->>'unit_label', ''),
      nullif(left(v_payload->>'note', 240), ''),
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
      eaten_on = excluded.eaten_on, food_name = excluded.food_name,
      unit_label = excluded.unit_label, note = excluded.note, kcal = excluded.kcal,
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
