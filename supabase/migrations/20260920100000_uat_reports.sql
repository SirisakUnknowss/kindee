-- Error reports and user feedback collected during UAT.
-- Rows are written only by the /api/report Pages Function using the service
-- key, so no client-facing policies are granted; read them with SQL.

create table if not exists public.app_reports (
  id              uuid primary key default gen_random_uuid(),
  kind            text not null check (kind in ('error', 'feedback')),
  user_id         uuid references auth.users on delete set null,
  installation_id text,
  message         text not null,
  detail          text,
  rating          smallint check (rating between 1 and 5),
  url             text,
  app_version     text,
  user_agent      text,
  resolved_at     timestamptz,
  created_at      timestamptz not null default now()
);

alter table public.app_reports enable row level security;

create index if not exists app_reports_kind_created on public.app_reports (kind, created_at desc);
create index if not exists app_reports_installation on public.app_reports (installation_id, created_at desc);

comment on table public.app_reports is
  'UAT error reports and in-app feedback. Written by the trusted /api/report function only.';
comment on column public.app_reports.detail is
  'Stack trace for errors, or free-form context for feedback. Never contains food or weight data.';
