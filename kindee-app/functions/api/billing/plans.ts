import { priceId, stripeRequest, type BillingInterval, type PaidPlan } from '../../_shared/billing'
import { error, json, type PagesContext } from '../../_shared/http'

type StripePrice = { id: string; active: boolean; currency: string; unit_amount: number | null; recurring?: { interval: BillingInterval } }

export async function onRequestGet({ env }: PagesContext) {
  if (!env.STRIPE_SECRET_KEY) return json({ prices: [] })
  const plans: PaidPlan[] = ['plus', 'pro', 'unlimited']
  const intervals: BillingInterval[] = ['month', 'year']
  try {
    const prices = await Promise.all(plans.flatMap((plan) => intervals.map(async (interval) => {
      const id = priceId(env, plan, interval)
      if (!id) return null
      const price = await stripeRequest<StripePrice>(env, `prices/${encodeURIComponent(id)}`, undefined, 'GET')
      if (!price.active || price.unit_amount === null || price.recurring?.interval !== interval) return null
      return { plan, interval, amount: price.unit_amount, currency: price.currency }
    })))
    return json({ prices: prices.filter(Boolean) }, 200, { 'cache-control': 'public, max-age=300' })
  } catch (cause) {
    console.error('Price lookup failed', cause)
    return error(502, 'price_lookup_failed', 'Unable to load plan prices')
  }
}

export const onRequestPost = () => error(405, 'method_not_allowed', 'Use GET')
