-- Monitoring reads happen only in the trusted Pages Function.
-- Keep app reports unavailable to browser roles even when public-schema
-- default privileges differ between Supabase projects.

revoke all on table public.app_reports from public, anon, authenticated;
grant select, insert, update on table public.app_reports to service_role;

grant select on table public.entries, public.photo_jobs, public.usage_counters,
  public.entitlements to service_role;
