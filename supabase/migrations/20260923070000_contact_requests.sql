-- Contact requests from the landing page (landing/functions/api/contact.ts).
-- Written only by that Pages Function with the service key, so no client-facing
-- policies are granted; read them with SQL or a future admin view.

create table if not exists public.contact_requests (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (char_length(name) between 1 and 80),
  email           text not null check (char_length(email) between 3 and 160),
  topic           text not null check (topic in ('beta', 'general', 'business', 'support')),
  message         text not null check (char_length(message) between 10 and 2000),
  consent_version text not null,
  ip_hash         text,
  user_agent      text,
  status          text not null default 'new' check (status in ('new', 'replied', 'closed')),
  created_at      timestamptz not null default now()
);

alter table public.contact_requests enable row level security;

create index if not exists contact_requests_created on public.contact_requests (created_at desc);
create index if not exists contact_requests_ip_recent on public.contact_requests (ip_hash, created_at desc);

comment on table public.contact_requests is
  'Landing-page contact form. Consent covers replying only; rows are purged after 12 months.';
comment on column public.contact_requests.ip_hash is
  'SHA-256 of the client IP, used only for rate limiting. The raw IP is never stored.';

-- The consent text promises deletion after 12 months.
create extension if not exists pg_cron with schema pg_catalog;

-- Re-running the migration replaces the existing schedule instead of duplicating it.
select cron.unschedule(jobid) from cron.job where jobname = 'purge-old-contact-requests';

select cron.schedule(
  'purge-old-contact-requests',
  '30 19 * * *', -- 02:30 Asia/Bangkok
  $$delete from public.contact_requests where created_at < now() - interval '12 months'$$
);
