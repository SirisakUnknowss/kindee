const MAX_PER_SESSION = 20
const DEDUPE_WINDOW_MS = 60_000

export type ReportKind = 'error' | 'feedback'
export type ReportInput = { kind: ReportKind; message: string; detail?: string; rating?: number }

const seen = new Map<string, number>()
let sent = 0

/** The same error repeating in a loop is dropped for a minute; one session can never flood the table. */
export function shouldSend(key: string, now = Date.now()): boolean {
  if (sent >= MAX_PER_SESSION) return false
  const last = seen.get(key)
  if (last !== undefined && now - last < DEDUPE_WINDOW_MS) return false
  seen.set(key, now)
  sent += 1
  return true
}

export function resetReportThrottle() {
  seen.clear()
  sent = 0
}

export function buildReportBody(input: ReportInput, context: { installationId?: string; url?: string; appVersion?: string }) {
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

