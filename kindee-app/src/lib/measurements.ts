import { MEASURES, type BodyMeasurement, type BodyValues } from './body'
import { db, type BodyMeasurementItem } from './db'
import { supabase } from './supabase'

// Body measurements follow the favorites pattern: Dexie is the offline source of truth
// and an account session upserts dirty rows straight to Supabase (one row per user and day).

const COLUMN: Record<keyof BodyValues, string> = {
  weight: 'weight_kg', height: 'height_cm', shoulder: 'shoulder_cm', chest: 'chest_cm',
  waist: 'waist_cm', hip: 'hip_cm', thigh: 'thigh_cm', calf: 'calf_cm',
}

export function toMeasurement(item: BodyMeasurementItem): BodyMeasurement {
  const out: BodyMeasurement = { day: item.measured_on, updatedAt: item.updated_at, pending: item.dirty === 1 }
  for (const { key } of MEASURES) if (typeof item[key] === 'number') out[key] = item[key]
  return out
}

export async function saveMeasurementLocal(day: string, values: BodyValues): Promise<void> {
  const record: BodyMeasurementItem = { measured_on: day, deleted_at: null, updated_at: new Date().toISOString(), dirty: 1 }
  for (const { key } of MEASURES) if (values[key] != null) record[key] = values[key]
  await db.body_measurements.put(record)
  void syncMeasurements()
}

export async function deleteMeasurementLocal(day: string): Promise<void> {
  const existing = await db.body_measurements.get(day)
  if (!existing) return
  await db.body_measurements.put({ ...existing, deleted_at: new Date().toISOString(), updated_at: new Date().toISOString(), dirty: 1 })
  void syncMeasurements()
}

let syncing: Promise<void> | null = null

/** Best-effort push of dirty rows; a guest or offline session simply keeps them local. */
export function syncMeasurements(): Promise<void> {
  if (syncing) return syncing
  syncing = performSync().finally(() => { syncing = null })
  return syncing
}

async function performSync(): Promise<void> {
  if (!supabase || !navigator.onLine) return
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return
  const dirty = await db.body_measurements.where('dirty').equals(1).toArray()
  for (const row of dirty) {
    if (row.deleted_at) {
      const { error } = await supabase.from('body_measurements').delete().eq('user_id', session.user.id).eq('measured_on', row.measured_on)
      if (!error && (await db.body_measurements.get(row.measured_on))?.updated_at === row.updated_at) {
        await db.body_measurements.delete(row.measured_on)
      }
      continue
    }
    const payload: Record<string, unknown> = { user_id: session.user.id, measured_on: row.measured_on, updated_at: row.updated_at }
    for (const { key } of MEASURES) payload[COLUMN[key]] = row[key] ?? null
    const { error } = await supabase.from('body_measurements').upsert(payload, { onConflict: 'user_id,measured_on' })
    if (error) continue
    // A newer local edit made during the request stays dirty.
    if ((await db.body_measurements.get(row.measured_on))?.updated_at === row.updated_at) {
      await db.body_measurements.update(row.measured_on, { dirty: 0 })
    }
  }
}

/** Pulls the account's measurements into Dexie (login / app start); local unsynced edits win. */
export async function pullMeasurements(): Promise<void> {
  if (!supabase || !navigator.onLine) return
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return
  const { data, error } = await supabase.from('body_measurements').select('*')
  if (error || !data) return
  await db.transaction('rw', db.body_measurements, async () => {
    for (const row of data as Record<string, unknown>[]) {
      const day = String(row.measured_on)
      const local = await db.body_measurements.get(day)
      if (local && local.dirty === 1) continue
      const record: BodyMeasurementItem = { measured_on: day, deleted_at: null, updated_at: String(row.updated_at), dirty: 0 }
      for (const { key } of MEASURES) {
        const v = row[COLUMN[key]]
        if (v != null) record[key] = Number(v)
      }
      await db.body_measurements.put(record)
    }
  })
}
