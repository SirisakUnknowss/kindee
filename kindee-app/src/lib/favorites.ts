import { db, type FavoriteItem } from './db'
import { supabase } from './supabase'

// Favorites are low-volume, user-owned rows, so — like the search tab already does with
// `search_foods` / `food_portions` — we talk to Supabase directly from the client instead of
// routing through a bespoke outbox. Dexie stays the source of truth for offline reads; a
// failed remote write just leaves `dirty: 1` for the next opportunistic sync.

export async function saveFavoriteLocal(input: {
  client_id?: string
  name: string
  amount: number
  unit: string
  kcal: number
  protein?: number
  carb?: number
  fat?: number
  note?: string
}): Promise<FavoriteItem> {
  const now = new Date().toISOString()
  const clientId = input.client_id || crypto.randomUUID()
  const existing = await db.favorites.get(clientId)
  const record: FavoriteItem = {
    ...existing,
    client_id: clientId,
    name: input.name,
    amount: input.amount,
    unit: input.unit,
    kcal: input.kcal,
    protein: input.protein,
    carb: input.carb,
    fat: input.fat,
    note: input.note,
    created_at: existing?.created_at ?? now,
    last_used_at: existing?.last_used_at ?? now,
    deleted_at: null,
    updated_at: now,
    dirty: 1,
  }
  await db.favorites.put(record)
  void syncFavorites()
  return record
}

export async function touchFavoriteUsage(clientId: string): Promise<void> {
  const existing = await db.favorites.get(clientId)
  if (!existing) return
  await db.favorites.update(clientId, { last_used_at: new Date().toISOString(), dirty: 1 })
  void syncFavorites()
}

export async function deleteFavoriteLocal(clientId: string): Promise<void> {
  const existing = await db.favorites.get(clientId)
  if (!existing) return
  await db.favorites.put({ ...existing, deleted_at: new Date().toISOString(), updated_at: new Date().toISOString(), dirty: 1 })
  void syncFavorites()
}

let syncing: Promise<void> | null = null

/** Best-effort push of dirty favorites to Supabase; a guest or offline session simply keeps them local. */
export function syncFavorites(): Promise<void> {
  if (syncing) return syncing
  syncing = performSync().finally(() => { syncing = null })
  return syncing
}

async function performSync(): Promise<void> {
  if (!supabase || !navigator.onLine) return
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return

  const dirty = await db.favorites.where('dirty').equals(1).toArray()
  for (const fav of dirty) {
    if (fav.deleted_at) {
      if (fav.remote_id) {
        const { error } = await supabase.from('favorites').delete().eq('id', fav.remote_id)
        if (error) continue
      }
      await db.favorites.delete(fav.client_id)
      continue
    }
    const payload = {
      user_id: session.user.id,
      client_id: fav.client_id,
      name: fav.name,
      amount: fav.amount,
      unit: fav.unit,
      kcal: fav.kcal,
      protein: fav.protein ?? null,
      carb: fav.carb ?? null,
      fat: fav.fat ?? null,
      note: fav.note ?? null,
      last_used_at: fav.last_used_at,
      updated_at: fav.updated_at,
    }
    const { data, error } = await supabase
      .from('favorites')
      .upsert(payload, { onConflict: 'user_id,client_id' })
      .select('id')
      .single()
    if (error) continue
    await db.favorites.update(fav.client_id, { remote_id: data.id, dirty: 0 })
  }
}

/** Pulls the account's favorites from Supabase into Dexie (e.g. on login / app start). */
export async function pullFavorites(): Promise<void> {
  if (!supabase || !navigator.onLine) return
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return
  const { data, error } = await supabase
    .from('favorites')
    .select('id,client_id,name,amount,unit,kcal,protein,carb,fat,note,created_at,last_used_at,updated_at')
    .is('deleted_at', null)
  if (error || !data) return
  await db.transaction('rw', db.favorites, async () => {
    for (const row of data) {
      const local = await db.favorites.get(row.client_id)
      if (local && local.dirty === 1) continue
      await db.favorites.put({
        client_id: row.client_id,
        remote_id: row.id,
        name: row.name,
        amount: Number(row.amount),
        unit: row.unit,
        kcal: Number(row.kcal),
        protein: row.protein == null ? undefined : Number(row.protein),
        carb: row.carb == null ? undefined : Number(row.carb),
        fat: row.fat == null ? undefined : Number(row.fat),
        note: row.note ?? undefined,
        created_at: row.created_at,
        last_used_at: row.last_used_at,
        deleted_at: null,
        updated_at: row.updated_at,
        dirty: 0,
      })
    }
  })
}
