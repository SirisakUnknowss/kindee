alter extension pg_trgm set schema extensions;

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
