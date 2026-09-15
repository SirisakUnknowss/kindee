import { LEGAL_VERSION } from '../config/legal'
import { db } from './db'
import { supabase } from './supabase'
import type { Profile, Session } from './types'

const EXPORT_TABLES = [
  'profiles', 'weight_logs', 'entries', 'daily_summaries', 'food_reports',
  'photo_jobs', 'privacy_consents',
] as const

export async function downloadMyData(session: Session, profile: Profile | null) {
  const [entries, foodsCache, outbox, meta, scanQueue] = await Promise.all([
    db.entries.toArray(), db.foods_cache.toArray(), db.outbox.toArray(),
    db.meta.toArray(), db.scan_queue.toArray(),
  ])
  const cloud: Record<string, unknown> = {}
  const warnings: string[] = []
  const cloudClient = supabase
  if (session.kind === 'account' && cloudClient) {
    await Promise.all(EXPORT_TABLES.map(async (table) => {
      const { data, error } = await cloudClient.from(table).select('*')
      if (error) warnings.push(`${table}: ${error.message}`)
      else cloud[table] = data
    }))
  }
  const payload = {
    exportFormat: 'KinDee personal data export',
    legalVersion: LEGAL_VERSION,
    generatedAt: new Date().toISOString(),
    account: session.kind === 'account' ? { userId: session.userId, email: session.email } : { kind: 'guest' },
    profile,
    deviceData: { entries, foodsCache, pendingSyncOperations: outbox, settings: meta, pendingBarcodeScans: scanQueue },
    cloudData: cloud,
    warnings,
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `kindee-data-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(url)
  return warnings
}

export async function clearDeviceData() {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((table) => table.clear()))
  })
  localStorage.removeItem('kindee.v1')
}

export async function deleteAccount(accessToken: string) {
  const response = await fetch('/api/account', {
    method: 'DELETE',
    headers: { authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null
    throw new Error(body?.error?.message || 'account_delete_failed')
  }
}
