import Dexie, { type Table } from 'dexie'
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

export interface FoodCacheItem {
  id: string
  name_th: string
  name_en?: string
  brand?: string
  barcode?: string
  category?: string
  is_dish: boolean
  is_packaged: boolean
  kcal_100g: number
  protein_100g?: number
  carb_100g?: number
  fat_100g?: number
  tokens: string[]
  cached_at: string
}

export interface OutboxItem {
  seq?: number
  client_id: string
  op: 'insert' | 'update' | 'delete'
  payload: Partial<LocalEntry>
  tries: number
  created_at: string
  next_attempt_at?: string
  last_error?: string
}

export interface MetaItem {
  key: string
  value: any
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
  dirty: number // 1 = pending sync, 0 = synced
}

export interface ScanQueueItem {
  seq?: number
  barcode: string
  scanned_at: string
}

export class KinDeeDatabase extends Dexie {
  entries!: Table<LocalEntry, string>
  foods_cache!: Table<FoodCacheItem, string>
  outbox!: Table<OutboxItem, number>
  meta!: Table<MetaItem, string>
  scan_queue!: Table<ScanQueueItem, number>
  favorites!: Table<FavoriteItem, string>

  constructor() {
    super('KinDeeOfflineDB')
    this.version(1).stores({
      entries: 'client_id, eaten_on, [eaten_on+meal], updated_at, dirty',
      foods_cache: 'id, barcode, *tokens, cached_at',
      outbox: '++seq, client_id, op, tries',
      meta: 'key',
      scan_queue: '++seq, barcode'
    })
    this.version(2).stores({
      entries: 'client_id, eaten_on, [eaten_on+meal], updated_at, dirty',
      foods_cache: 'id, barcode, *tokens, cached_at',
      outbox: '++seq, client_id, op, tries, next_attempt_at',
      meta: 'key',
      scan_queue: '++seq, barcode'
    })
    this.version(3).stores({
      entries: 'client_id, eaten_on, [eaten_on+meal], updated_at, dirty',
      foods_cache: 'id, barcode, *tokens, cached_at',
      outbox: '++seq, client_id, op, tries, next_attempt_at',
      meta: 'key',
      scan_queue: '++seq, barcode',
      favorites: 'client_id, deleted_at, dirty, last_used_at',
    })
  }
}

export const db = new KinDeeDatabase()

export async function getInstallationId(): Promise<string> {
  const existing = await db.meta.get('installation_id')
  if (typeof existing?.value === 'string' && existing.value) return existing.value
  const value = crypto.randomUUID()
  await db.meta.put({ key: 'installation_id', value })
  return value
}
