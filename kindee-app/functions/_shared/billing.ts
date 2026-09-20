import { supabaseHeaders, type Env } from './http'

export type PaidPlan = 'plus' | 'pro' | 'unlimited'
export type BillingInterval = 'month' | 'year'

export type Entitlement = {
  user_id: string
  plan: 'free' | PaidPlan
  status: string
  billing_interval: BillingInterval | null
  provider_customer_id: string | null
  provider_subscription_id: string | null
  period_end: string | null
  trial_started_at: string | null
  trial_end: string | null
  cancel_at_period_end: boolean
}

const priceKeys: Record<`${PaidPlan}_${BillingInterval}`, keyof Env> = {
  plus_month: 'STRIPE_PRICE_PLUS_MONTH',
  plus_year: 'STRIPE_PRICE_PLUS_YEAR',
  pro_month: 'STRIPE_PRICE_PRO_MONTH',
  pro_year: 'STRIPE_PRICE_PRO_YEAR',
  unlimited_month: 'STRIPE_PRICE_UNLIMITED_MONTH',
  unlimited_year: 'STRIPE_PRICE_UNLIMITED_YEAR',
}

export function priceId(env: Env, plan: PaidPlan, interval: BillingInterval) {
  return env[priceKeys[`${plan}_${interval}`]]?.trim()
}

export function planForPrice(env: Env, candidate: string) {
  for (const [key, envKey] of Object.entries(priceKeys)) {
    if (env[envKey]?.trim() === candidate) {
      const [plan, interval] = key.split('_') as [PaidPlan, BillingInterval]
      return { plan, interval }
    }
  }
  return null
}

export async function stripeRequest<T>(env: Env, path: string, body?: URLSearchParams, method = 'POST') {
  if (!env.STRIPE_SECRET_KEY) throw new Error('billing_unconfigured')
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: {
      authorization: `Basic ${btoa(`${env.STRIPE_SECRET_KEY}:`)}`,
      ...(body ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
    },
    body,
  })
  const payload = await response.json() as T & { error?: { message?: string } }
  if (!response.ok) throw new Error(payload.error?.message || 'stripe_request_failed')
  return payload
}

export async function getEntitlement(env: Env, userId: string) {
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/entitlements?user_id=eq.${encodeURIComponent(userId)}&select=*&limit=1`,
    { headers: supabaseHeaders(env, undefined, true) },
  )
  if (!response.ok) throw new Error('entitlement_read_failed')
  return ((await response.json()) as Entitlement[])[0] ?? null
}

export async function upsertEntitlement(env: Env, row: Partial<Entitlement> & Pick<Entitlement, 'user_id'>) {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/entitlements?on_conflict=user_id`, {
    method: 'POST',
    headers: {
      ...supabaseHeaders(env, undefined, true),
      prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(row),
  })
  if (!response.ok) throw new Error(`entitlement_write_failed:${await response.text()}`)
  return ((await response.json()) as Entitlement[])[0]
}

export function appOrigin(request: Request, env: Env) {
  const configured = env.APP_URL?.trim()
  if (configured) {
    const url = new URL(configured)
    if (env.APP_ENV === 'production' && url.protocol !== 'https:') throw new Error('invalid_app_url')
    return url.origin
  }
  return new URL(request.url).origin
}
