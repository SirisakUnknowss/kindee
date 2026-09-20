import { planForPrice, upsertEntitlement, type BillingInterval, type PaidPlan } from '../../_shared/billing'
import { error, json, supabaseHeaders, type PagesContext } from '../../_shared/http'

type StripeEvent = { id: string; type: string; data: { object: StripeObject } }
type StripeObject = {
  id: string
  customer?: string
  subscription?: string
  client_reference_id?: string
  status?: string
  cancel_at_period_end?: boolean
  current_period_end?: number
  trial_end?: number
  metadata?: Record<string, string>
  items?: { data?: Array<{ current_period_end?: number; price?: { id?: string } }> }
}

const hex = (bytes: ArrayBuffer) => [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
const safeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return mismatch === 0
}

async function validSignature(payload: string, signature: string | null, secret: string) {
  if (!signature) return false
  const parts = signature.split(',').map((part) => part.split('=', 2))
  const timestamp = parts.find(([key]) => key === 't')?.[1]
  const signatures = parts.filter(([key]) => key === 'v1').map(([, value]) => value)
  if (!timestamp || !signatures.length || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const expected = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`)))
  return signatures.some((candidate) => safeEqual(candidate, expected))
}

const stripeStatus = (status?: string) => {
  if (status === 'canceled' || status === 'incomplete_expired') return 'cancelled'
  if (['active', 'trialing', 'past_due', 'incomplete', 'unpaid', 'paused'].includes(status ?? '')) return status!
  return 'past_due'
}

async function userIdForCustomer(env: PagesContext['env'], customerId?: string) {
  if (!customerId) return null
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/entitlements?provider_customer_id=eq.${encodeURIComponent(customerId)}&select=user_id&limit=1`,
    { headers: supabaseHeaders(env, undefined, true) },
  )
  if (!response.ok) return null
  return ((await response.json()) as Array<{ user_id: string }>)[0]?.user_id ?? null
}

async function alreadyProcessed(env: PagesContext['env'], eventId: string) {
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/billing_webhook_events?event_id=eq.${encodeURIComponent(eventId)}&select=event_id&limit=1`,
    { headers: supabaseHeaders(env, undefined, true) },
  )
  return response.ok && ((await response.json()) as unknown[]).length > 0
}

async function markProcessed(env: PagesContext['env'], event: StripeEvent) {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/billing_webhook_events`, {
    method: 'POST',
    headers: { ...supabaseHeaders(env, undefined, true), prefer: 'resolution=ignore-duplicates' },
    body: JSON.stringify({ event_id: event.id, event_type: event.type }),
  })
  if (!response.ok) throw new Error('webhook_event_write_failed')
}

export async function onRequestPost({ request, env }: PagesContext) {
  if (!env.STRIPE_WEBHOOK_SECRET || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return error(503, 'billing_unconfigured', 'Billing webhook is not configured')
  }
  const payload = await request.text()
  if (!await validSignature(payload, request.headers.get('stripe-signature'), env.STRIPE_WEBHOOK_SECRET)) {
    return error(400, 'invalid_signature', 'Invalid webhook signature')
  }

  const event = JSON.parse(payload) as StripeEvent
  if (await alreadyProcessed(env, event.id)) return json({ received: true, duplicate: true })

  try {
    const object = event.data.object
    if (event.type === 'checkout.session.completed') {
      const userId = object.client_reference_id ?? object.metadata?.user_id
      if (userId && object.customer) {
        await upsertEntitlement(env, { user_id: userId, provider_customer_id: object.customer })
      }
    }

    if (event.type.startsWith('customer.subscription.')) {
      const price = object.items?.data?.[0]?.price?.id
      const mapped = price ? planForPrice(env, price) : null
      const plan = (object.metadata?.plan as PaidPlan | undefined) ?? mapped?.plan
      const interval = (object.metadata?.interval as BillingInterval | undefined) ?? mapped?.interval
      const userId = object.metadata?.user_id ?? await userIdForCustomer(env, object.customer)
      if (!userId) throw new Error('subscription_user_missing')

      const cancelled = event.type === 'customer.subscription.deleted'
      if (!cancelled && (!plan || !interval)) throw new Error('subscription_price_unmapped')
      const periodEnd = object.current_period_end ?? object.items?.data?.[0]?.current_period_end
      await upsertEntitlement(env, {
        user_id: userId,
        plan: cancelled ? 'free' : (plan ?? 'free'),
        status: cancelled ? 'cancelled' : stripeStatus(object.status),
        billing_interval: cancelled ? null : (interval ?? null),
        provider_customer_id: object.customer ?? null,
        provider_subscription_id: object.id,
        period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        trial_end: object.trial_end ? new Date(object.trial_end * 1000).toISOString() : null,
        cancel_at_period_end: Boolean(object.cancel_at_period_end),
      })
    }

    await markProcessed(env, event)
    return json({ received: true })
  } catch (cause) {
    console.error('Billing webhook failed', cause)
    return error(500, 'webhook_failed', 'Webhook processing failed')
  }
}

export const onRequestGet = () => error(405, 'method_not_allowed', 'Use POST')
