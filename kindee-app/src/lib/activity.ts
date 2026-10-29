import { db, type ExerciseLogItem, type WaterLogItem } from './db'
import { supabase } from './supabase'

// Water and exercise follow the body-measurements pattern: Dexie is the offline source of
// truth and an account session writes dirty rows straight to Supabase.

export const WATER_STEP = 250
export const WATER_MAX = 10_000

/** ราว 30 มล./กก. ปัดเป็นแก้วละ 250 มล. อยู่ในช่วง 1.5–4 ลิตร */
export function defaultWaterGoal(weight?: number) {
  if (!weight || !Number.isFinite(weight) || weight <= 0) return 2000
  return Math.min(4000, Math.max(1500, Math.round((weight * 30) / WATER_STEP) * WATER_STEP))
}

export const clampWater = (ml: number) => Math.min(WATER_MAX, Math.max(0, Math.round(ml)))

/** 'included' = เป้า TDEE นับกิจกรรมแล้ว ไม่บวกซ้ำ · 'add' = บวกแคลที่เผาเข้าไปในงบวันนั้น */
export type ExerciseMode = 'included' | 'add'

export type Exercise = { uid: string; day: string; name: string; minutes?: number; kcal: number; pending?: boolean }

// MET values from the 2011 Compendium of Physical Activities (rounded, moderate effort).
export const EXERCISE_PRESETS = [
  { id: 'walk', label: 'เดินเร็ว', met: 4.3, icon: 'ph ph-person-simple-walk' },
  { id: 'run', label: 'วิ่ง', met: 8.3, icon: 'ph ph-person-simple-run' },
  { id: 'bike', label: 'ปั่นจักรยาน', met: 6.8, icon: 'ph ph-bicycle' },
  { id: 'swim', label: 'ว่ายน้ำ', met: 5.8, icon: 'ph ph-swimming-pool' },
  { id: 'weights', label: 'เวทเทรนนิ่ง', met: 5.0, icon: 'ph ph-barbell' },
  { id: 'aerobic', label: 'เต้นแอโรบิก', met: 7.3, icon: 'ph ph-music-notes' },
  { id: 'badminton', label: 'แบดมินตัน', met: 5.5, icon: 'ph ph-lightning' },
  { id: 'football', label: 'ฟุตบอล', met: 7.0, icon: 'ph ph-soccer-ball' },
  { id: 'yoga', label: 'โยคะ', met: 2.5, icon: 'ph ph-flower-lotus' },
] as const

/** kcal ≈ MET × น้ำหนัก (กก.) × ชั่วโมง */
export function exerciseKcal(met: number, weight: number, minutes: number) {
  if (![met, weight, minutes].every((v) => Number.isFinite(v) && v > 0)) return 0
  return Math.round(met * weight * (minutes / 60))
}

/** งบวันนั้นหลังรวมการออกกำลังกาย */
export const dailyBudget = (target: number, burned: number, mode: ExerciseMode) =>
  mode === 'add' ? target + Math.max(0, burned) : target

export const toExercise = (row: ExerciseLogItem): Exercise => ({
  uid: row.client_id, day: row.done_on, name: row.name, minutes: row.minutes, kcal: row.kcal, pending: row.dirty === 1,
})

export async function addWaterLocal(day: string, delta: number): Promise<number> {
  const ml = await db.transaction('rw', db.water_logs, async () => {
    const next = clampWater(((await db.water_logs.get(day))?.ml ?? 0) + delta)
    await db.water_logs.put({ day, ml: next, updated_at: new Date().toISOString(), dirty: 1 })
    return next
  })
  void syncActivity()
  return ml
}

export async function saveExerciseLocal(input: { day: string; name: string; minutes?: number; kcal: number }): Promise<Exercise> {
  const row: ExerciseLogItem = {
    client_id: crypto.randomUUID(), done_on: input.day, name: input.name.trim().slice(0, 60),
    minutes: input.minutes, kcal: Math.round(input.kcal), deleted_at: null, updated_at: new Date().toISOString(), dirty: 1,
  }
  await db.exercise_logs.put(row)
  void syncActivity()
  return toExercise(row)
}

export async function deleteExerciseLocal(uid: string): Promise<void> {
  const existing = await db.exercise_logs.get(uid)
  if (!existing) return
  const now = new Date().toISOString()
  await db.exercise_logs.put({ ...existing, deleted_at: now, updated_at: now, dirty: 1 })
  void syncActivity()
}

let syncing: Promise<void> | null = null

/** Best-effort push of dirty rows; a guest or offline session simply keeps them local. */
export function syncActivity(): Promise<void> {
  if (syncing) return syncing
  syncing = performSync().finally(() => { syncing = null })
  return syncing
}

async function performSync(): Promise<void> {
  if (!supabase || !navigator.onLine) return
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return
  const userId = session.user.id

  for (const row of await db.water_logs.where('dirty').equals(1).toArray()) {
    const { error } = await supabase.from('water_logs').upsert(
      { user_id: userId, logged_on: row.day, ml: row.ml, updated_at: row.updated_at },
      { onConflict: 'user_id,logged_on' },
    )
    // A newer local edit made during the request stays dirty.
    if (!error && (await db.water_logs.get(row.day))?.updated_at === row.updated_at) {
      await db.water_logs.update(row.day, { dirty: 0 })
    }
  }

  for (const row of await db.exercise_logs.where('dirty').equals(1).toArray()) {
    const { error } = row.deleted_at
      ? await supabase.from('exercise_logs').delete().eq('id', row.client_id)
      : await supabase.from('exercise_logs').upsert({
        id: row.client_id, user_id: userId, done_on: row.done_on, name: row.name,
        minutes: row.minutes ?? null, kcal: row.kcal, updated_at: row.updated_at,
      })
    if (error || (await db.exercise_logs.get(row.client_id))?.updated_at !== row.updated_at) continue
    if (row.deleted_at) await db.exercise_logs.delete(row.client_id)
    else await db.exercise_logs.update(row.client_id, { dirty: 0 })
  }
}

/** Pulls the account's water and exercise rows into Dexie; local unsynced edits win. */
export async function pullActivity(): Promise<void> {
  if (!supabase || !navigator.onLine) return
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return
  const [water, exercise] = await Promise.all([
    supabase.from('water_logs').select('logged_on,ml,updated_at'),
    supabase.from('exercise_logs').select('id,done_on,name,minutes,kcal,updated_at'),
  ])
  await db.transaction('rw', db.water_logs, db.exercise_logs, async () => {
    for (const row of (water.data ?? []) as Record<string, unknown>[]) {
      const day = String(row.logged_on)
      if ((await db.water_logs.get(day))?.dirty === 1) continue
      const item: WaterLogItem = { day, ml: Number(row.ml), updated_at: String(row.updated_at), dirty: 0 }
      await db.water_logs.put(item)
    }
    for (const row of (exercise.data ?? []) as Record<string, unknown>[]) {
      const id = String(row.id)
      if ((await db.exercise_logs.get(id))?.dirty === 1) continue
      await db.exercise_logs.put({
        client_id: id, done_on: String(row.done_on), name: String(row.name),
        minutes: row.minutes == null ? undefined : Number(row.minutes), kcal: Number(row.kcal),
        deleted_at: null, updated_at: String(row.updated_at), dirty: 0,
      })
    }
  })
}
