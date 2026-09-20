import { db, getInstallationId } from './db'
import { supabase } from './supabase'

const APP_VERSION = import.meta.env.VITE_APP_ENV ?? 'unknown'
const MAX_PER_SESSION = 20
const DEDUPE_WINDOW_MS = 60_000

type ReportKind = 'error' | 'feedback'

export type ReportInput = {
  kind: ReportKind
  message: string
  detail?: string
  rating?: number
}

const seen = new Map<string, number>()
let sent = 0

/**
 * True when this report should be sent: the same error repeating in a loop is
 * dropped for a minute, and one session can never flood the table.
 */
export function shouldSend(key: string, now = Date.now()): boolean {
  if (sent >= MAX_PER_SESSION) return false
  const last = seen.get(key)
  if (last !== undefined && now - last < DEDUPE_WINDOW_MS) return false
  seen.set(key, now)
  sent += 1
  return true
}

/** Test seam: forget what this session has already reported. */
export function resetReportThrottle() {
  seen.clear()
  sent = 0
}

/** Trims a value to what the API accepts, so oversized stacks never fail the call. */
export function buildReportBody(input: ReportInput, context: {
  installationId?: string
  url?: string
  appVersion?: string
}) {
  return {
    kind: input.kind,
    message: input.message.trim().slice(0, 500),
    detail: input.detail?.trim().slice(0, 4_000),
    rating: input.kind === 'feedback' && Number.isInteger(input.rating) ? input.rating : undefined,
    installationId: context.installationId,
    url: context.url?.slice(0, 500),
    appVersion: context.appVersion,
  }
}

async function post(input: ReportInput): Promise<boolean> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    const session = supabase ? (await supabase.auth.getSession()).data.session : null
    if (session) headers.Authorization = `Bearer ${session.access_token}`
    const body = buildReportBody(input, {
      installationId: await getInstallationId().catch(() => undefined),
      url: location.href,
      appVersion: APP_VERSION,
    })
    const response = await fetch('/api/report', { method: 'POST', headers, body: JSON.stringify(body) })
    return response.ok
  } catch {
    return false
  }
}

/** Fire-and-forget: reporting must never break the screen it is reporting on. */
export function reportError(message: string, detail?: string) {
  if (!shouldSend(`error:${message}`)) return
  void post({ kind: 'error', message, detail })
}

export async function sendFeedback(message: string, rating?: number): Promise<boolean> {
  if (!message.trim()) return false
  return post({ kind: 'feedback', message, rating })
}

/** Queue a report while offline is pointless for UAT, so failures are dropped. */
export function installErrorReporting() {
  window.addEventListener('error', (event) => {
    reportError(event.message || 'window.error', event.error?.stack)
  })
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    reportError(
      typeof reason === 'string' ? reason : reason?.message ?? 'unhandledrejection',
      reason?.stack,
    )
  })
}

/** Exposed for the feedback screen so testers can see their reports landed. */
export async function pendingSyncSummary() {
  const [pending, exhausted] = await Promise.all([
    db.outbox.count(),
    db.outbox.where('tries').aboveOrEqual(10).count(),
  ])
  return { pending, exhausted }
}
