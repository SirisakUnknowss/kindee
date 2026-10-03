import { randomUUID } from 'expo-crypto'
import { commit, db, getInstallationId, nextSeq, type LocalEntry, type OutboxItem } from './db'
import { isOnline } from './net'
import { API_BASE, supabase } from './supabase'

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

function enqueue(clientId: string, op: OutboxItem['op'], payload: LocalEntry) {
  db.outbox = db.outbox.filter((item) => item.client_id !== clientId)
  db.outbox.push({ seq: nextSeq(), client_id: clientId, op, payload, tries: 0, created_at: new Date().toISOString() })
}

export async function saveLocalEntry(
  entry: Omit<LocalEntry, 'client_id' | 'updated_at' | 'dirty'> & { client_id?: string },
): Promise<LocalEntry> {
  const now = new Date().toISOString()
  const clientId = entry.client_id || randomUUID()
  const existing = db.entries[clientId]
  const localRecord: LocalEntry = {
    ...existing,
    ...entry,
    client_id: clientId,
    deleted_at: null,
    updated_at: now,
    dirty: 1,
  }
  db.entries[clientId] = localRecord
  enqueue(clientId, existing ? 'update' : 'insert', localRecord)
  commit()
  void flushOutbox()
  return localRecord
}

export async function deleteLocalEntry(clientId: string): Promise<void> {
  const existing = db.entries[clientId]
  if (!existing) return
  const now = new Date().toISOString()
  const deletedRecord: LocalEntry = { ...existing, deleted_at: now, updated_at: now, dirty: 1 }
  db.entries[clientId] = deletedRecord
  enqueue(clientId, 'delete', deletedRecord)
  commit()
  void flushOutbox()
}

export async function retryFailedSync(): Promise<SyncResult> {
  for (const item of db.outbox) {
    if (item.tries >= MAX_TRIES) {
      item.tries = 0
      item.next_attempt_at = undefined
      item.last_error = undefined
    }
  }
  commit()
  return flushOutbox(true)
}

export function flushOutbox(force = false): Promise<SyncResult> {
  if (flushPromise) return flushPromise
  flushPromise = performFlush(force).finally(() => { flushPromise = null })
  return flushPromise
}

const exhausted = () => db.outbox.filter((item) => item.tries >= MAX_TRIES).length

function status(reason?: SyncResult['reason']): SyncResult {
  return { success: db.outbox.length === 0, pendingCount: db.outbox.length, exhaustedCount: exhausted(), reason }
}

async function performFlush(force: boolean): Promise<SyncResult> {
  if (!isOnline()) return status('offline')
  if (!supabase) return status('unconfigured')

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return status('guest')

  const nowMs = Date.now()
  const candidates = [...db.outbox]
    .sort((a, b) => a.seq - b.seq)
    .filter((item) => item.tries < MAX_TRIES && (
      force || !item.next_attempt_at || Date.parse(item.next_attempt_at) <= nowMs
    ))
    .slice(0, MAX_BATCH)
  if (!candidates.length) return status()

  let response: Response
  try {
    response = await fetch(`${API_BASE}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({
        installationId: getInstallationId(),
        ops: candidates.map(({ client_id, op, payload }) => ({ client_id, op, payload })),
        since: (db.meta.last_pulled_at as string | undefined) ?? null,
      }),
    })
  } catch {
    markFailed(candidates, 'network_error')
    return status('offline')
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { code?: string } } | null
    markFailed(candidates, body?.error?.code ?? `http_${response.status}`)
    return status('server')
  }

  const result = await response.json() as { applied: string[]; changes: LocalEntry[]; now: string }
  const applied = new Set(result.applied ?? [])
  for (const item of candidates) {
    if (!applied.has(item.client_id)) continue
    db.outbox = db.outbox.filter((o) => o.client_id !== item.client_id)
    const local = db.entries[item.client_id]
    if (local) local.dirty = 0
  }
  for (const remote of result.changes ?? []) {
    const local = db.entries[remote.client_id]
    if (!local || (local.dirty === 0 && remote.updated_at > local.updated_at)) {
      db.entries[remote.client_id] = { ...remote, dirty: 0 }
    }
  }
  if (result.now) db.meta.last_pulled_at = result.now
  commit()
  return status()
}

function markFailed(items: OutboxItem[], error: string) {
  for (const item of items) {
    const live = db.outbox.find((o) => o.seq === item.seq)
    if (!live) continue
    live.tries += 1
    live.next_attempt_at = nextAttempt(live.tries)
    live.last_error = error
  }
  commit()
}
