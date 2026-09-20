import { appOrigin, getEntitlement, priceId, stripeRequest, upsertEntitlement, type BillingInterval, type PaidPlan } from '../../_shared/billing'
import { authenticatedUser, error, json, type PagesContext } from '../../_shared/http'

type CheckoutBody = { plan?: PaidPlan; interval?: BillingInterval }
type StripeCustomer = { id: string }
type StripeSession = { id: string; url: string | null }

const paidPlans = new Set<PaidPlan>(['plus', 'pro', 'unlimited'])
const intervals = new Set<BillingInterval>(['month', 'year'])

export async function onRequestPost({ request, env }: PagesContext) {
  if (!env.STRIPE_SECRET_KEY || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return error(503, 'billing_unconfigured', 'Billing is not configured')
  }
  const user = await authenticatedUser(request, env)
  if (!user) return error(401, 'unauthorized', 'Sign in before choosing a plan')

  const body = await request.json().catch(() => ({})) as CheckoutBody
  if (!body.plan || !paidPlans.has(body.plan) || !body.interval || !intervals.has(body.interval)) {
    return error(400, 'invalid_plan', 'Choose a valid plan and billing interval')
  }
  const selectedPrice = priceId(env, body.plan, body.interval)
  if (!selectedPrice) return error(503, 'price_unconfigured', 'This plan is not configured yet')

  try {
    let entitlement = await getEntitlement(env, user.id)
    if (entitlement && entitlement.plan !== 'free' && ['active', 'trialing', 'past_due'].includes(entitlement.status)) {
      return error(409, 'subscription_exists', 'Manage your current subscription in the billing portal')
    }

    let customerId = entitlement?.provider_customer_id
    if (!customerId) {
      const customerBody = new URLSearchParams({
        ...(user.email ? { email: user.email } : {}),
        'metadata[user_id]': user.id,
      })
      customerId = (await stripeRequest<StripeCustomer>(env, 'customers', customerBody)).id
    }

    const trialEligible = !entitlement?.trial_started_at
    await upsertEntitlement(env, {
      user_id: user.id,
      plan: 'free',
      status: 'active',
      billing_interval: null,
      provider_customer_id: customerId,
    })

    const origin = appOrigin(request, env)
    const params = new URLSearchParams({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: user.id,
      success_url: `${origin}/?billing=success`,
      cancel_url: `${origin}/?billing=cancelled`,
      'line_items[0][price]': selectedPrice,
      'line_items[0][quantity]': '1',
      'metadata[user_id]': user.id,
      'metadata[plan]': body.plan,
      'metadata[interval]': body.interval,
      'subscription_data[metadata][user_id]': user.id,
      'subscription_data[metadata][plan]': body.plan,
      'subscription_data[metadata][interval]': body.interval,
      allow_promotion_codes: 'true',
      locale: 'th',
    })
    if (trialEligible) params.set('subscription_data[trial_period_days]', '30')

    const session = await stripeRequest<StripeSession>(env, 'checkout/sessions', params)
    if (!session.url) throw new Error('checkout_url_missing')
    // Claim the one-time trial only after Stripe successfully creates the session.
    // This prevents a provider outage from consuming the user's trial.
    if (trialEligible) {
      await upsertEntitlement(env, { user_id: user.id, trial_started_at: new Date().toISOString() })
    }
    return json({ url: session.url })
  } catch (cause) {
    console.error('Checkout session failed', cause)
    return error(502, 'checkout_failed', 'Unable to start checkout')
  }
}

export const onRequestGet = () => error(405, 'method_not_allowed', 'Use POST')
