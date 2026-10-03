import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { getInstallationId } from './db'
import { API_BASE, supabase } from './supabase'

const APP_VERSION = `${Platform.OS}-${Constants.expoConfig?.version ?? 'unknown'}`
import { buildReportBody, shouldSend, type ReportInput } from './reportCore'

export { resetReportThrottle, shouldSend, buildReportBody } from './reportCore'

async function post(input: ReportInput): Promise<boolean> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    const session = supabase ? (await supabase.auth.getSession()).data.session : null
    if (session) headers.Authorization = `Bearer ${session.access_token}`
    const body = buildReportBody(input, { installationId: getInstallationId(), url: `app://${Platform.OS}`, appVersion: APP_VERSION })
    const response = await fetch(`${API_BASE}/api/report`, { method: 'POST', headers, body: JSON.stringify(body) })
    return response.ok
  } catch {
    return false
  }
}

export function reportError(message: string, detail?: string) {
  if (!shouldSend(`error:${message}`)) return
  void post({ kind: 'error', message, detail })
}

export async function sendFeedback(message: string, rating?: number): Promise<boolean> {
  if (!message.trim()) return false
  return post({ kind: 'feedback', message, rating })
}

type GlobalErrorHandler = (error: Error, isFatal?: boolean) => void
type ErrorUtilsLike = { getGlobalHandler: () => GlobalErrorHandler; setGlobalHandler: (handler: GlobalErrorHandler) => void }

/** Uncaught JS errors go to app_reports so testers do not have to describe them. */
export function installErrorReporting() {
  const errorUtils = (globalThis as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils
  if (!errorUtils) return
  const previous = errorUtils.getGlobalHandler()
  errorUtils.setGlobalHandler((error, fatal) => {
    reportError(error?.message || 'js.error', error?.stack)
    previous(error, fatal)
  })
}
