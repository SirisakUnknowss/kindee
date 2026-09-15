-- Evidence of explicit consent for optional processing such as photo analysis.
create table if not exists public.privacy_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  purpose text not null check (purpose in ('photo_ai_analysis')),
  version text not null,
  provider text not null,
  granted_at timestamptz not null,
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, purpose, version)
);

alter table public.privacy_consents enable row level security;

create policy "read_own_privacy_consents" on public.privacy_consents
  for select to authenticated
  using ((select auth.uid()) = user_id);

grant select on public.privacy_consents to authenticated;

alter table public.photo_jobs
  add column if not exists consent_version text,
  add column if not exists consented_at timestamptz,
  add column if not exists expires_at timestamptz not null default (now() + interval '90 days');

create index if not exists photo_jobs_expiry on public.photo_jobs (expires_at);

comment on table public.privacy_consents is
  'Proof of explicit optional-purpose consent. Written by trusted server functions and readable by the data subject.';
comment on column public.photo_jobs.expires_at is
  'Retention deadline. Photo endpoint deletes expired rows opportunistically; production must also run the documented daily cleanup.';
