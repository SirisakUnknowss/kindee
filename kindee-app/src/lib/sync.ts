import { db, getInstallationId, type LocalEntry, type OutboxItem } from './db'
import { supabase } from './supabase'

const MAX_BATCH = 200
const MAX_TRIES = 10
const MAX_BACKOFF_MS = 5 * 60_000
let flushPromise: Promise<SyncResult> | null = null

export type SyncResult = {
  success: boolean
  pendingCount: number
  exhaustedCount: number
  reason?: 'guest' | 'offline' | 'server' | 'unconfigured'
}

const nextAttempt = (tries: number) => {
  const base = Math.min(MAX_BACKOFF_MS, 1_000 * 2 ** Math.max(0, tries - 1))
  const jitter = Math.round(base * (0.75 + Math.random() * 0.5))
  return new Date(Date.now() + jitter).toISOString()
}

async function enqueue(clientId: string, op: OutboxItem['op'], payload: LocalEntry) {
  await db.outbox.where('client_id').equals(clientId).delete()
  await db.outbox.add({ client_id: clientId, op, payload, tries: 0, created_at: new Date().toISOString() })
}

export async function saveLocalEntry(
  entry: Omit<LocalEntry, 'client_id' | 'updated_at' | 'dirty'> & { client_id?: string },
): Promise<LocalEntry> {
  const now = new Date().toISOString()
  const clientId = entry.client_id || crypto.randomUUID()
  const existing = await db.entries.get(clientId)
  const localRecord: LocalEntry = {
    ...existing,
    ...entry,
    client_id: clientId,
    deleted_at: null,
    updated_at: now,
    dirty: 1,
  }
  await db.transaction('rw', db.entries, db.outbox, async () => {
    await db.entries.put(localRecord)
    await enqueue(clientId, existing ? 'update' : 'insert', localRecord)
  })
  void flushOutbox()
  return localRecord
}

export async function deleteLocalEntry(clientId: string): Promise<void> {
  const existing = await db.entries.get(clientId)
  if (!existing) return
  const now = new Date().toISOString()
  const deletedRecord: LocalEntry = { ...existing, deleted_at: now, updated_at: now, dirty: 1 }
  await db.transaction('rw', db.entries, db.outbox, async () => {
    await db.entries.put(deletedRecord)
    await enqueue(clientId, 'delete', deletedRecord)
  })
  void flushOutbox()
}

export async function retryFailedSync(): Promise<SyncResult> {
  await db.outbox.where('tries').aboveOrEqual(MAX_TRIES).modify({
    tries: 0,
    next_attempt_at: undefined,
    last_error: undefined,
  })
  return flushOutbox(true)
}

export function flushOutbox(force = false): Promise<SyncResult> {
  if (flushPromise) return flushPromise
  flushPromise = performFlush(force).finally(() => { flushPromise = null })
  return flushPromise
}

async function performFlush(force: boolean): Promise<SyncResult> {
  const pendingCount = await db.outbox.count()
  const exhaustedCount = await db.outbox.where('tries').aboveOrEqual(MAX_TRIES).count()
  if (!navigator.onLine) return { success: false, pendingCount, exhaustedCount, reason: 'offline' }
  if (!supabase) return { success: false, pendingCount, exhaustedCount, reason: 'unconfigured' }

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { success: false, pendingCount, exhaustedCount, reason: 'guest' }

  const nowMs = Date.now()
  const candidates = (await db.outbox.orderBy('seq').toArray())
    .filter((item) => item.tries < MAX_TRIES && (
      force || !item.next_attempt_at || Date.parse(item.next_attempt_at) <= nowMs
    ))
    .slice(0, MAX_BATCH)
  if (!candidates.length) return { success: pendingCount === 0, pendingCount, exhaustedCount }

  let response: Response
  try {
    const lastPulledMeta = await db.meta.get('last_pulled_at')
    response = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({
        installationId: await getInstallationId(),
        ops: candidates.map(({ client_id, op, payload }) => ({ client_id, op, payload })),
        since: lastPulledMeta?.value ?? null,
      }),
    })
  } catch {
    await markFailed(candidates, 'network_error')
    return status('offline')
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { code?: string } } | null
    await markFailed(candidates, body?.error?.code ?? `http_${response.status}`)
    return status('server')
  }

  const result = await response.json() as { applied: string[]; changes: LocalEntry[]; now: string }
  const applied = new Set(result.applied ?? [])
  await db.transaction('rw', db.entries, db.outbox, db.meta, async () => {
    for (const item of candidates) {
      if (!applied.has(item.client_id)) continue
      await db.outbox.where('client_id').equals(item.client_id).delete()
      await db.entries.update(item.client_id, { dirty: 0 })
    }
    for (const remote of result.changes ?? []) {
      const local = await db.entries.get(remote.client_id)
      if (!local || (local.dirty === 0 && remote.updated_at > local.updated_at)) {
        await db.entries.put({ ...remote, dirty: 0 })
      }
    }
    if (result.now) await db.meta.put({ key: 'last_pulled_at', value: result.now })
  })
  return status()
}

async function markFailed(items: OutboxItem[], error: string) {
  await db.transaction('rw', db.outbox, async () => {
    for (const item of items) {
      if (item.seq == null) continue
      const tries = item.tries + 1
      await db.outbox.update(item.seq, { tries, next_attempt_at: nextAttempt(tries), last_error: error })
    }
  })
}

async function status(reason?: SyncResult['reason']): Promise<SyncResult> {
  const pendingCount = await db.outbox.count()
  const exhaustedCount = await db.outbox.where('tries').aboveOrEqual(MAX_TRIES).count()
  return { success: pendingCount === 0, pendingCount, exhaustedCount, reason }
}
