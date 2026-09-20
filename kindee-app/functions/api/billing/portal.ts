import { appOrigin, getEntitlement, stripeRequest } from '../../_shared/billing'
import { authenticatedUser, error, json, type PagesContext } from '../../_shared/http'

type PortalSession = { url: string }

export async function onRequestPost({ request, env }: PagesContext) {
  if (!env.STRIPE_SECRET_KEY || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return error(503, 'billing_unconfigured', 'Billing is not configured')
  }
  const user = await authenticatedUser(request, env)
  if (!user) return error(401, 'unauthorized', 'Sign in to manage billing')

  try {
    const entitlement = await getEntitlement(env, user.id)
    if (!entitlement?.provider_customer_id) return error(404, 'customer_not_found', 'No billing account exists yet')
    const session = await stripeRequest<PortalSession>(env, 'billing_portal/sessions', new URLSearchParams({
      customer: entitlement.provider_customer_id,
      return_url: `${appOrigin(request, env)}/?billing=return`,
      locale: 'th',
    }))
    return json({ url: session.url })
  } catch (cause) {
    console.error('Billing portal failed', cause)
    return error(502, 'portal_failed', 'Unable to open the billing portal')
  }
}

export const onRequestGet = () => error(405, 'method_not_allowed', 'Use POST')
