import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { LEGAL_VERSION } from '../config/legal'
import { clearDb, db } from './db'
import { API_BASE, supabase } from './supabase'
import type { Profile, Session } from './types'

const EXPORT_TABLES = [
  'profiles', 'weight_logs', 'entries', 'daily_summaries', 'food_reports',
  'photo_jobs', 'privacy_consents',
] as const

/** Writes the personal-data export to a JSON file and opens the share sheet. */
export async function downloadMyData(session: Session, profile: Profile | null) {
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
    deviceData: {
      entries: Object.values(db.entries),
      favorites: Object.values(db.favorites),
      pendingSyncOperations: db.outbox,
      settings: db.meta,
      pendingBarcodeScans: db.scanQueue,
    },
    cloudData: cloud,
    warnings,
  }
  const file = new File(Paths.cache, `kindee-data-${new Date().toISOString().slice(0, 10)}.json`)
  if (file.exists) file.delete()
  file.create()
  file.write(JSON.stringify(payload, null, 2))
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json' })
  return warnings
}

export async function clearDeviceData() {
  await clearDb()
}

export async function deleteAccount(accessToken: string) {
  const response = await fetch(`${API_BASE}/api/account`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null
    throw new Error(body?.error?.message || 'account_delete_failed')
  }
}
