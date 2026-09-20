import { supabase } from './supabase'

export type MonitoringData = {
  generatedAt: string
  summary: {
    totalUsers: number
    activeUsers7d: number
    newUsers7d: number
    totalEntries: number
    totalPhotoJobs: number
    failedPhotoJobs: number
    unresolvedErrors: number
    averageRating: number | null
  }
  plans: Array<{ plan: string; count: number }>
  series: Array<{ day: string; entries: number; photos: number; errors: number }>
  users: Array<{
    id: string
    email: string
    createdAt: string
    lastSignInAt: string | null
    plan: string
    status: string
    interval: string | null
    periodEnd: string | null
    entries14d: number
    photosThisMonth: number
  }>
  logs: Array<{
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
  }>
}

export async function loadMonitoring(): Promise<MonitoringData> {
  const session = supabase ? (await supabase.auth.getSession()).data.session : null
  if (!session) throw new Error('unauthorized')
  const response = await fetch('/api/admin/monitoring', {
    headers: { authorization: `Bearer ${session.access_token}` },
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: { code?: string } } | null
    throw new Error(payload?.error?.code ?? `http_${response.status}`)
  }
  return await response.json() as MonitoringData
}
