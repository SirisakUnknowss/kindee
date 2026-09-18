-- Daily purge of expired photo analysis records (PDPA retention).
-- The /api/photo endpoint also deletes expired rows opportunistically; this job
-- guarantees cleanup even when the endpoint is idle.

create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.purge_expired_photo_jobs()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted integer;
begin
  delete from public.photo_jobs where expires_at < now();
  get diagnostics deleted = row_count;
  return deleted;
end;
$$;

revoke all on function public.purge_expired_photo_jobs() from public, anon, authenticated;

-- Re-running the migration replaces the existing schedule instead of duplicating it.
select cron.unschedule(jobid) from cron.job where jobname = 'purge-expired-photo-jobs';

select cron.schedule(
  'purge-expired-photo-jobs',
  '0 19 * * *', -- 02:00 Asia/Bangkok
  $$select public.purge_expired_photo_jobs()$$
);
