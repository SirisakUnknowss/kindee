import { MEASURES, type BodyMeasurement, type BodyValues } from './body'
import { commit, db, type BodyMeasurementItem } from './db'
import { isOnline } from './net'
import { supabase } from './supabase'

// Body measurements follow the favorites pattern: the local snapshot is the offline source of
// truth and an account session upserts dirty rows straight to Supabase (one row per user and day).

const COLUMN: Record<keyof BodyValues, string> = {
  weight: 'weight_kg', height: 'height_cm', shoulder: 'shoulder_cm', chest: 'chest_cm',
  waist: 'waist_cm', hip: 'hip_cm', thigh: 'thigh_cm', calf: 'calf_cm',
}

export function readMeasurements(): BodyMeasurement[] {
  return Object.values(db.bodyMeasurements)
    .filter((item) => !item.deleted_at)
    .sort((a, b) => a.measured_on.localeCompare(b.measured_on))
    .map((item) => {
      const out: BodyMeasurement = { day: item.measured_on, updatedAt: item.updated_at, pending: item.dirty === 1 }
      for (const { key } of MEASURES) if (typeof item[key] === 'number') out[key] = item[key]
      return out
    })
}

export function saveMeasurementLocal(day: string, values: BodyValues) {
  const record: BodyMeasurementItem = { measured_on: day, deleted_at: null, updated_at: new Date().toISOString(), dirty: 1 }
  for (const { key } of MEASURES) if (values[key] != null) record[key] = values[key]
  db.bodyMeasurements[day] = record
  commit()
  void syncMeasurements()
}

export function deleteMeasurementLocal(day: string) {
  const existing = db.bodyMeasurements[day]
  if (!existing) return
  db.bodyMeasurements[day] = { ...existing, deleted_at: new Date().toISOString(), updated_at: new Date().toISOString(), dirty: 1 }
  commit()
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
  if (!supabase || !isOnline()) return
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return
  const dirty = Object.values(db.bodyMeasurements).filter((m) => m.dirty === 1)
  for (const row of dirty) {
    if (row.deleted_at) {
      const { error } = await supabase.from('body_measurements').delete().eq('user_id', session.user.id).eq('measured_on', row.measured_on)
      if (error) continue
      if (db.bodyMeasurements[row.measured_on]?.updated_at === row.updated_at) delete db.bodyMeasurements[row.measured_on]
      commit()
      continue
    }
    const payload: Record<string, unknown> = { user_id: session.user.id, measured_on: row.measured_on, updated_at: row.updated_at }
    for (const { key } of MEASURES) payload[COLUMN[key]] = row[key] ?? null
    const { error } = await supabase.from('body_measurements').upsert(payload, { onConflict: 'user_id,measured_on' })
    if (error) continue
    const live = db.bodyMeasurements[row.measured_on]
    // A newer local edit made during the request stays dirty.
    if (live && live.updated_at === row.updated_at) db.bodyMeasurements[row.measured_on] = { ...live, dirty: 0 }
    commit()
  }
}

/** Pulls the account's measurements (login / app start); local unsynced edits win. */
export async function pullMeasurements(): Promise<void> {
  if (!supabase || !isOnline()) return
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return
  const { data, error } = await supabase.from('body_measurements').select('*')
  if (error || !data) return
  for (const row of data as Record<string, unknown>[]) {
    const day = String(row.measured_on)
    if (db.bodyMeasurements[day]?.dirty === 1) continue
    const record: BodyMeasurementItem = { measured_on: day, deleted_at: null, updated_at: String(row.updated_at), dirty: 0 }
    for (const { key } of MEASURES) {
      const v = row[COLUMN[key]]
      if (v != null) record[key] = Number(v)
    }
    db.bodyMeasurements[day] = record
  }
  commit()
}
