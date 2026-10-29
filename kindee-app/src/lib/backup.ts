import { db, type BodyMeasurementItem, type ExerciseLogItem, type FavoriteItem, type LocalEntry, type WaterLogItem } from './db'
import { flushOutbox } from './sync'
import { syncMeasurements } from './measurements'
import { syncActivity } from './activity'
import { syncFavorites } from './favorites'
import type { ExerciseMode } from './activity'
import type { LengthUnit } from './body'
import type { Profile } from './types'

// A restorable backup of this device's records. Unlike the PDPA export in privacy.ts it
// leaves out caches and cloud copies, and import merges rows back into Dexie by key.

export const BACKUP_FORMAT = 'kindee-backup'
export const BACKUP_VERSION = 1
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024

export type BackupSettings = { showMacros?: boolean; lengthUnit?: LengthUnit; waterGoal?: number | null; exerciseMode?: ExerciseMode }

export type Backup = {
  format: typeof BACKUP_FORMAT
  version: number
  exportedAt: string
  profile: Profile | null
  settings: BackupSettings
  entries: LocalEntry[]
  favorites: FavoriteItem[]
  bodyMeasurements: BodyMeasurementItem[]
  water: WaterLogItem[]
  exercises: ExerciseLogItem[]
}

export type ImportSummary = { entries: number; favorites: number; bodyMeasurements: number; water: number; exercises: number; days: number }

export async function buildBackup(profile: Profile | null, settings: BackupSettings): Promise<Backup> {
  const [entries, favorites, bodyMeasurements, water, exercises] = await Promise.all([
    db.entries.toArray(), db.favorites.toArray(), db.body_measurements.toArray(), db.water_logs.toArray(), db.exercise_logs.toArray(),
  ])
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    profile,
    settings,
    entries: entries.filter((e) => !e.deleted_at),
    favorites: favorites.filter((f) => !f.deleted_at),
    bodyMeasurements: bodyMeasurements.filter((m) => !m.deleted_at),
    water,
    exercises: exercises.filter((e) => !e.deleted_at),
  }
}

export async function downloadBackup(profile: Profile | null, settings: BackupSettings) {
  const backup = await buildBackup(profile, settings)
  const blob = new Blob([JSON.stringify(backup)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `kindee-backup-${backup.exportedAt.slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(url)
}

const DAY = /^\d{4}-\d{2}-\d{2}$/
const isNum = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max
const isStr = (v: unknown, max = 200) => typeof v === 'string' && v.trim().length > 0 && v.length <= max
const MEALS = new Set(['breakfast', 'lunch', 'dinner', 'snack'])
const SOURCES = new Set(['search', 'recent', 'barcode', 'photo', 'manual'])
const UUID = /^[0-9a-f-]{36}$/i

function validEntry(e: Partial<LocalEntry>): e is LocalEntry {
  return isStr(e.client_id, 36) && UUID.test(e.client_id!) && MEALS.has(String(e.meal)) && SOURCES.has(String(e.entry_source))
    && isStr(e.food_name) && isNum(e.qty, 0.001, 1000) && isNum(e.kcal, 0, 100_000) && DAY.test(String(e.eaten_on))
}

/** Mirrors /api/sync validation so one old row cannot block the whole sync batch. */
export function syncableEntry(e: LocalEntry, now = Date.now()) {
  if (e.qty <= 0 || e.qty > 100 || e.kcal > 10_000) return false
  const eaten = Date.parse(`${e.eaten_on}T00:00:00Z`)
  return eaten >= now - 366 * 86_400_000 && eaten <= now + 2 * 86_400_000
}

/** Parses and validates a backup file's text; throws a Thai message on failure. */
export function parseBackup(text: string): Backup {
  if (text.length > MAX_BACKUP_BYTES) throw new Error('ไฟล์ใหญ่เกิน 10 MB')
  let raw: Partial<Backup>
  try {
    raw = JSON.parse(text) as Partial<Backup>
  } catch {
    throw new Error('อ่านไฟล์ไม่ได้ ต้องเป็นไฟล์ .json ที่ส่งออกจาก KinDee')
  }
  if (!raw || raw.format !== BACKUP_FORMAT) throw new Error('ไม่ใช่ไฟล์สำรองของ KinDee (ไฟล์ "ส่งออกข้อมูลของฉัน" ใช้เรียกคืนไม่ได้)')
  if (typeof raw.version !== 'number' || raw.version > BACKUP_VERSION) throw new Error('ไฟล์นี้มาจากแอปเวอร์ชันใหม่กว่า ลองอัปเดตแอปก่อน')
  const list = <T,>(v: unknown) => (Array.isArray(v) ? (v as T[]) : [])
  return {
    format: BACKUP_FORMAT,
    version: raw.version,
    exportedAt: String(raw.exportedAt ?? ''),
    profile: raw.profile && isNum(raw.profile.target, 500, 10_000) && isNum(raw.profile.weight, 20, 400) ? raw.profile : null,
    settings: raw.settings && typeof raw.settings === 'object' ? raw.settings : {},
    entries: list<Partial<LocalEntry>>(raw.entries).filter(validEntry),
    favorites: list<FavoriteItem>(raw.favorites).filter((f) => isStr(f?.client_id, 36) && isStr(f.name) && isStr(f.unit, 60) && isNum(f.amount, 0.001, 1000) && isNum(f.kcal, 0, 100_000)),
    bodyMeasurements: list<BodyMeasurementItem>(raw.bodyMeasurements).filter((m) => DAY.test(String(m?.measured_on))),
    water: list<WaterLogItem>(raw.water).filter((w) => DAY.test(String(w?.day)) && isNum(w.ml, 0, 10_000)),
    exercises: list<ExerciseLogItem>(raw.exercises).filter((e) => isStr(e?.client_id, 36) && UUID.test(e.client_id) && DAY.test(String(e.done_on)) && isStr(e.name, 60) && isNum(e.kcal, 0, 5000)),
  }
}

export function summarize(b: Backup): ImportSummary {
  const days = new Set([...b.entries.map((e) => e.eaten_on), ...b.water.map((w) => w.day), ...b.exercises.map((e) => e.done_on)])
  return { entries: b.entries.length, favorites: b.favorites.length, bodyMeasurements: b.bodyMeasurements.length, water: b.water.length, exercises: b.exercises.length, days: days.size }
}

/** Merges the backup into this device. Rows with the same key are replaced; nothing is deleted. */
export async function restoreBackup(b: Backup): Promise<void> {
  const now = new Date().toISOString()
  const dirty = { updated_at: now, dirty: 1 }
  await db.transaction('rw', [db.entries, db.outbox, db.favorites, db.body_measurements, db.water_logs, db.exercise_logs], async () => {
    for (const e of b.entries) {
      const existing = await db.entries.get(e.client_id)
      const record: LocalEntry = { ...e, deleted_at: null, ...dirty }
      await db.entries.put(record)
      if (!syncableEntry(record)) continue
      await db.outbox.where('client_id').equals(e.client_id).delete()
      await db.outbox.add({ client_id: e.client_id, op: existing ? 'update' : 'insert', payload: record, tries: 0, created_at: now })
    }
    await db.favorites.bulkPut(b.favorites.map((f) => ({ ...f, remote_id: undefined, deleted_at: null, ...dirty })))
    await db.body_measurements.bulkPut(b.bodyMeasurements.map((m) => ({ ...m, deleted_at: null, ...dirty })))
    await db.water_logs.bulkPut(b.water.map((w) => ({ ...w, ...dirty })))
    await db.exercise_logs.bulkPut(b.exercises.map((e) => ({ ...e, deleted_at: null, ...dirty })))
  })
  void flushOutbox(true)
  void syncFavorites()
  void syncMeasurements()
  void syncActivity()
}
