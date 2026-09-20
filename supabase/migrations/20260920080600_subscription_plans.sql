-- Four-tier subscriptions with Stripe-backed monthly/yearly billing.
-- Entitlements remain server-managed; clients can only read their own row.

alter table public.entitlements drop constraint if exists entitlements_plan_check;
alter table public.entitlements drop constraint if exists entitlements_status_check;

update public.entitlements set plan = 'pro' where plan = 'premium';

alter table public.entitlements
  add column if not exists billing_interval text,
  add column if not exists provider_subscription_id text,
  add column if not exists trial_started_at timestamptz,
  add column if not exists trial_end timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists created_at timestamptz not null default now();

-- The previous premium tier had no interval. Preserve those subscribers as monthly Pro.
update public.entitlements set billing_interval = 'month' where plan = 'pro' and billing_interval is null;

alter table public.entitlements
  add constraint entitlements_plan_check check (plan in ('free', 'plus', 'pro', 'unlimited')),
  add constraint entitlements_status_check check (status in ('active', 'trialing', 'past_due', 'cancelled', 'incomplete', 'unpaid', 'paused')),
  add constraint entitlements_billing_interval_check check (
    (plan = 'free' and billing_interval is null)
    or (plan <> 'free' and billing_interval in ('month', 'year'))
  );

create unique index if not exists entitlements_provider_subscription_id_idx
  on public.entitlements (provider_subscription_id)
  where provider_subscription_id is not null;

create index if not exists entitlements_provider_customer_id_idx
  on public.entitlements (provider_customer_id)
  where provider_customer_id is not null;

-- Used only by the service role to make webhook retries idempotent.
create table if not exists public.billing_webhook_events (
  event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

alter table public.billing_webhook_events enable row level security;
revoke all on public.billing_webhook_events from public, anon, authenticated;
grant select, insert on public.billing_webhook_events to service_role;

-- Existing projects may no longer expose new public tables automatically.
-- The entitlement table is intentionally read-only for signed-in users.
revoke all on public.entitlements from anon, authenticated;
grant select on public.entitlements to authenticated;
grant select, insert, update on public.entitlements to service_role;
