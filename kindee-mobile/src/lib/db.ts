import AsyncStorage from '@react-native-async-storage/async-storage'
import { randomUUID } from 'expo-crypto'
import type { Meal } from './types'

export interface LocalEntry {
  client_id: string
  food_id?: string
  portion_id?: string
  qty: number
  grams?: number
  meal: Meal
  eaten_at: string
  eaten_on: string
  food_name: string
  unit_label?: string
  note?: string
  kcal: number
  protein?: number
  carb?: number
  fat?: number
  entry_source: 'search' | 'recent' | 'barcode' | 'photo' | 'manual'
  deleted_at?: string | null
  updated_at: string
  dirty: number // 1 = pending sync, 0 = synced
}

export interface OutboxItem {
  seq: number
  client_id: string
  op: 'insert' | 'update' | 'delete'
  payload: Partial<LocalEntry>
  tries: number
  created_at: string
  next_attempt_at?: string
  last_error?: string
}

export interface FavoriteItem {
  client_id: string
  remote_id?: string
  name: string
  amount: number
  unit: string
  kcal: number
  protein?: number
  carb?: number
  fat?: number
  note?: string
  created_at: string
  last_used_at: string
  deleted_at?: string | null
  updated_at: string
  dirty: number
}

export interface ScanQueueItem {
  barcode: string
  scanned_at: string
}

type Snapshot = {
  entries: Record<string, LocalEntry>
  outbox: OutboxItem[]
  favorites: Record<string, FavoriteItem>
  meta: Record<string, unknown>
  scanQueue: ScanQueueItem[]
  nextSeq: number
}

const KEY = 'kindee.db.v1'
const emptySnapshot = (): Snapshot => ({
  entries: {}, outbox: [], favorites: {}, meta: {}, scanQueue: [], nextSeq: 1,
})

/**
 * Offline-first store. Everything lives in memory (the UI reads it synchronously)
 * and is written back to AsyncStorage after each change. This replaces the web
 * app's IndexedDB/Dexie layer; the table shapes are identical so the sync
 * protocol with /api/sync is unchanged.
 */
export const db: Snapshot = emptySnapshot()

const listeners = new Set<() => void>()
let writeTimer: ReturnType<typeof setTimeout> | undefined
let hydrated: Promise<void> | null = null

export function subscribeDb(fn: () => void) {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

/** Persist and notify. Call after every mutation of `db`. */
export function commit() {
  listeners.forEach((fn) => fn())
  if (writeTimer) clearTimeout(writeTimer)
  writeTimer = setTimeout(() => { void flushToDisk() }, 250)
}

export async function flushToDisk() {
  if (writeTimer) { clearTimeout(writeTimer); writeTimer = undefined }
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(db))
  } catch (error) {
    console.warn('db persist failed', error)
  }
}

export function hydrateDb(): Promise<void> {
  if (!hydrated) {
    hydrated = (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY)
        if (raw) Object.assign(db, emptySnapshot(), JSON.parse(raw) as Partial<Snapshot>)
      } catch (error) {
        console.warn('db hydrate failed', error)
      }
      listeners.forEach((fn) => fn())
    })()
  }
  return hydrated
}

export async function clearDb() {
  Object.assign(db, emptySnapshot())
  await AsyncStorage.removeItem(KEY)
  listeners.forEach((fn) => fn())
}

export const nextSeq = () => db.nextSeq++

export function getInstallationId(): string {
  const existing = db.meta.installation_id
  if (typeof existing === 'string' && existing) return existing
  const value = randomUUID()
  db.meta.installation_id = value
  commit()
  return value
}
