import { authenticatedUser, error, json, supabaseHeaders, type PagesContext } from '../_shared/http'

const MAX_MESSAGE = 500
const MAX_DETAIL = 4_000
const MAX_PER_INSTALLATION_PER_HOUR = 60

const text = (value: unknown, max: number) =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : undefined

/**
 * Collects UAT error reports and in-app feedback. Guests can report too, so the
 * bearer token is optional; when present the report is attributed to that user.
 */
export async function onRequestPost({ request, env }: PagesContext) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return error(503, 'service_unconfigured', 'Reporting is not configured')
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const kind = body?.kind === 'feedback' ? 'feedback' : body?.kind === 'error' ? 'error' : null
  const message = text(body?.message, MAX_MESSAGE)
  if (!kind || !message) return error(400, 'invalid_report', 'A kind and a message are required')

  const ratingValue = Number(body?.rating)
  const rating = kind === 'feedback' && Number.isInteger(ratingValue) && ratingValue >= 1 && ratingValue <= 5
    ? ratingValue
    : null
  const installationId = text(body?.installationId, 64)
  const adminHeaders = supabaseHeaders(env, undefined, true)

  // Keep a runaway error loop on one device from filling the table.
  if (installationId) {
    const since = new Date(Date.now() - 60 * 60_000).toISOString()
    const countResponse = await fetch(
      `${env.SUPABASE_URL}/rest/v1/app_reports?installation_id=eq.${encodeURIComponent(installationId)}&created_at=gte.${encodeURIComponent(since)}&select=id`,
      { headers: { ...adminHeaders, prefer: 'count=exact', range: '0-0' } },
    )
    const total = Number(countResponse.headers.get('content-range')?.split('/')[1] ?? 0)
    if (total >= MAX_PER_INSTALLATION_PER_HOUR) {
      return error(429, 'too_many_reports', 'Too many reports from this device; try again later')
    }
  }

  const user = await authenticatedUser(request, env)
  const insert = await fetch(`${env.SUPABASE_URL}/rest/v1/app_reports`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      kind,
      user_id: user?.id ?? null,
      installation_id: installationId ?? null,
      message,
      detail: text(body?.detail, MAX_DETAIL) ?? null,
      rating,
      url: text(body?.url, 500) ?? null,
      app_version: text(body?.appVersion, 100) ?? null,
      user_agent: text(request.headers.get('user-agent'), 300) ?? null,
    }),
  })
  if (!insert.ok) {
    console.error('report_insert_failed', insert.status, (await insert.text().catch(() => '')).slice(0, 300))
    return error(503, 'report_failed', 'The report could not be stored')
  }
  return json({ ok: true }, 202)
}
