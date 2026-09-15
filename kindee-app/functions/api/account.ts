import { authenticatedUser, error, json, supabaseHeaders, type PagesContext } from '../_shared/http'

export async function onRequestDelete({ request, env }: PagesContext) {
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return error(503, 'service_unconfigured', 'Account deletion is not configured')
  }
  const user = await authenticatedUser(request, env)
  if (!user) return error(401, 'unauthorized', 'Sign in again before deleting your account')

  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(user.id)}`, {
    method: 'DELETE',
    headers: supabaseHeaders(env, undefined, true),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    return error(502, 'account_delete_failed', detail || 'The account could not be deleted')
  }
  return json({ deleted: true })
}

export const onRequestGet = () => error(405, 'method_not_allowed', 'Use DELETE')

