import { authenticatedUser, error, isAdmin, json, supabaseHeaders, type Env, type PagesContext } from '../../_shared/http'

type AuthUser = {
  id: string
  email?: string
  created_at: string
  last_sign_in_at?: string
  app_metadata?: Record<string, unknown>
}

type EntitlementRow = {
  user_id: string
  plan: string
  status: string
  billing_interval: string | null
  period_end: string | null
}

type UsageRow = { user_id: string; feature: string; count: number; period_start: string }
type ReportRow = {
  id: string
  kind: 'error' | 'feedback'
  user_id: string | null
  installation_id: string | null
  message: string
  detail: string | null
  rating: number | null
  url: string | null
  app_version: string | null
  resolved_at: string | null
  created_at: string
}

const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString()
const dayKey = (date: Date) => date.toISOString().slice(0, 10)

async function rows<T>(env: Env, table: string, query: string, limit = 1000): Promise<T[]> {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: { ...supabaseHeaders(env, undefined, true), range: `0-${limit - 1}` },
  })
  if (!response.ok) throw new Error(`${table}_read_failed:${response.status}`)
  return await response.json() as T[]
}

async function exactCount(env: Env, table: string, filters = '') {
  const query = `select=*&limit=1${filters ? `&${filters}` : ''}`
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: 'HEAD',
    headers: { ...supabaseHeaders(env, undefined, true), prefer: 'count=exact', range: '0-0' },
  })
  if (!response.ok) throw new Error(`${table}_count_failed:${response.status}`)
  return Number(response.headers.get('content-range')?.split('/')[1] ?? 0)
}

export async function onRequestGet({ request, env }: PagesContext) {
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return error(503, 'service_unconfigured', 'Monitoring is not configured')
  }
  const viewer = await authenticatedUser(request, env)
  if (!viewer) return error(401, 'unauthorized', 'Sign in to view monitoring')
  if (!isAdmin(viewer)) return error(403, 'forbidden', 'Administrator access is required')

  try {
    const adminHeaders = supabaseHeaders(env, undefined, true)
    const monthStart = `${new Date().toISOString().slice(0, 7)}-01`
    const authResponse = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1000`, { headers: adminHeaders })
    if (!authResponse.ok) throw new Error(`auth_users_failed:${authResponse.status}`)
    const authPayload = await authResponse.json() as { users?: AuthUser[] }
    const authUsers = authPayload.users ?? []

    const [
      entitlements, usage, reports, recentEntries, recentPhotos,
      entryCount, photoCount, failedPhotoCount,
    ] = await Promise.all([
      rows<EntitlementRow>(env, 'entitlements', 'select=user_id,plan,status,billing_interval,period_end', 2000),
      rows<UsageRow>(env, 'usage_counters', `select=user_id,feature,count,period_start&period_start=gte.${monthStart}`, 5000),
      rows<ReportRow>(env, 'app_reports', 'select=id,kind,user_id,installation_id,message,detail,rating,url,app_version,resolved_at,created_at&order=created_at.desc', 100),
      rows<{ user_id: string; eaten_on: string; updated_at: string }>(env, 'entries', `select=user_id,eaten_on,updated_at&updated_at=gte.${encodeURIComponent(ago(14))}&deleted_at=is.null`, 5000),
      rows<{ user_id: string; status: string; created_at: string }>(env, 'photo_jobs', `select=user_id,status,created_at&created_at=gte.${encodeURIComponent(ago(14))}`, 5000),
      exactCount(env, 'entries', 'deleted_at=is.null'),
      exactCount(env, 'photo_jobs'),
      exactCount(env, 'photo_jobs', 'status=eq.failed'),
    ])

    const entitlementByUser = new Map(entitlements.map((row) => [row.user_id, row]))
    const photoUsageByUser = new Map(
      usage.filter((row) => row.feature === 'photo').map((row) => [row.user_id, row.count]),
    )
    const entryCountByUser = new Map<string, number>()
    for (const entry of recentEntries) entryCountByUser.set(entry.user_id, (entryCountByUser.get(entry.user_id) ?? 0) + 1)

    const users = authUsers.map((user) => {
      const entitlement = entitlementByUser.get(user.id)
      const currentPlan = entitlement && ['active', 'trialing', 'past_due'].includes(entitlement.status)
        ? entitlement.plan
        : 'free'
      return {
        id: user.id,
        email: user.email ?? '—',
        createdAt: user.created_at,
        lastSignInAt: user.last_sign_in_at ?? null,
        plan: currentPlan,
        status: entitlement?.status ?? 'active',
        interval: entitlement?.billing_interval ?? null,
        periodEnd: entitlement?.period_end ?? null,
        entries14d: entryCountByUser.get(user.id) ?? 0,
        photosThisMonth: photoUsageByUser.get(user.id) ?? 0,
      }
    }).sort((a, b) => (b.lastSignInAt ?? b.createdAt).localeCompare(a.lastSignInAt ?? a.createdAt))

    const active7d = authUsers.filter((user) => user.last_sign_in_at && user.last_sign_in_at >= ago(7)).length
    const new7d = authUsers.filter((user) => user.created_at >= ago(7)).length
    const unresolvedErrors = reports.filter((report) => report.kind === 'error' && !report.resolved_at).length
    const feedback = reports.filter((report) => report.kind === 'feedback')
    const ratings = feedback.flatMap((report) => report.rating ? [report.rating] : [])
    const averageRating = ratings.length ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length : null

    const plans = ['free', 'plus', 'pro', 'unlimited'].map((plan) => ({
      plan,
      count: users.filter((user) => user.plan === plan && ['active', 'trialing', 'past_due'].includes(user.status)).length,
    }))

    const series = Array.from({ length: 14 }, (_, index) => {
      const date = new Date(Date.now() - (13 - index) * 86_400_000)
      const day = dayKey(date)
      return {
        day,
        entries: recentEntries.filter((entry) => entry.eaten_on === day).length,
        photos: recentPhotos.filter((photo) => photo.created_at.startsWith(day)).length,
        errors: reports.filter((report) => report.kind === 'error' && report.created_at.startsWith(day)).length,
      }
    })

    return json({
      generatedAt: new Date().toISOString(),
      summary: {
        totalUsers: authUsers.length,
        activeUsers7d: active7d,
        newUsers7d: new7d,
        totalEntries: entryCount,
        totalPhotoJobs: photoCount,
        failedPhotoJobs: failedPhotoCount,
        unresolvedErrors,
        averageRating,
      },
      plans,
      series,
      users: users.slice(0, 200),
      logs: reports,
    }, 200, { 'cache-control': 'private, no-store' })
  } catch (cause) {
    console.error('admin_monitoring_failed', cause)
    return error(502, 'monitoring_failed', 'Monitoring data could not be loaded')
  }
}

export const onRequestPost = () => error(405, 'method_not_allowed', 'Use GET')
