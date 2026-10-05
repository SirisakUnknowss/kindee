import { authenticatedUser, error, json, supabaseHeaders, type Env, type PagesContext } from '../_shared/http'

/**
 * app_reports.user_id is "on delete set null", so deleting the auth user alone would
 * leave feedback text and installation ids behind. Remove those rows first, both the
 * ones attributed to the user and the ones from any installation the user claimed
 * (reports sent while still a guest carry only the installation id).
 */
async function deleteReports(env: Env, userId: string) {
  const headers = supabaseHeaders(env, undefined, true)
  const installations = await fetch(
    `${env.SUPABASE_URL}/rest/v1/installations?user_id=eq.${encodeURIComponent(userId)}&select=installation_id`,
    { headers },
  )
  if (!installations.ok) return false
  const ids = (await installations.json() as { installation_id: string }[]).map((row) => row.installation_id)

  const filters = [`user_id.eq.${userId}`]
  if (ids.length) filters.push(`installation_id.in.(${ids.join(',')})`)
  const removed = await fetch(
    `${env.SUPABASE_URL}/rest/v1/app_reports?or=(${encodeURIComponent(filters.join(','))})`,
    { method: 'DELETE', headers },
  )
  return removed.ok
}

export async function onRequestDelete({ request, env }: PagesContext) {
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return error(503, 'service_unconfigured', 'Account deletion is not configured')
  }
  const user = await authenticatedUser(request, env)
  if (!user) return error(401, 'unauthorized', 'Sign in again before deleting your account')

  // Fail before touching the account so the user can simply retry.
  if (!(await deleteReports(env, user.id))) {
    return error(502, 'account_delete_failed', 'The account data could not be fully deleted')
  }

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
