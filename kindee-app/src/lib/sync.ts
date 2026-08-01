import { db, type LocalEntry } from './db'
import { supabase } from './supabase'

let isFlushing = false

/**
 * Add or Update entry locally in Dexie and queue to Outbox
 */
export async function saveLocalEntry(entry: Omit<LocalEntry, 'client_id' | 'updated_at' | 'dirty'> & { client_id?: string }): Promise<LocalEntry> {
  const now = new Date().toISOString()
  const clientId = entry.client_id || crypto.randomUUID()

  const localRecord: LocalEntry = {
    ...entry,
    client_id: clientId,
    updated_at: now,
    dirty: 1,
  }

  // 1. Write to Dexie immediately
  await db.entries.put(localRecord)

  // 2. Push to Outbox queue
  await db.outbox.add({
    client_id: clientId,
    op: 'insert',
    payload: localRecord,
    tries: 0,
    created_at: now,
  })

  // 3. Trigger flush asynchronously
  flushOutbox().catch((err) => console.error('Sync flush error:', err))

  return localRecord
}

/**
 * Soft Delete entry locally in Dexie and queue to Outbox
 */
export async function deleteLocalEntry(clientId: string): Promise<void> {
  const now = new Date().toISOString()
  const existing = await db.entries.get(clientId)
  if (!existing) return

  const deletedRecord: LocalEntry = {
    ...existing,
    deleted_at: now,
    updated_at: now,
    dirty: 1,
  }

  await db.entries.put(deletedRecord)

  await db.outbox.add({
    client_id: clientId,
    op: 'delete',
    payload: deletedRecord,
    tries: 0,
    created_at: now,
  })

  flushOutbox().catch((err) => console.error('Sync flush error:', err))
}

/**
 * Flush Outbox queue to server idempotent endpoint (/api/sync or Supabase)
 */
export async function flushOutbox(): Promise<{ success: boolean; pendingCount: number }> {
  if (isFlushing) return { success: false, pendingCount: await db.outbox.count() }
  isFlushing = true

  try {
    const sessionRes = await supabase.auth.getSession()
    const session = sessionRes.data.session
    if (!session) {
      isFlushing = false
      return { success: false, pendingCount: await db.outbox.count() }
    }

    const items = await db.outbox.limit(200).toArray()
    if (items.length === 0) {
      isFlushing = false
      return { success: true, pendingCount: 0 }
    }

    const lastPulledMeta = await db.meta.get('last_pulled_at')
    const since = lastPulledMeta?.value || null

    // Send payload to sync endpoint
    const response = await fetch('/api/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        ops: items,
        since,
      }),
    })

    if (!response.ok) {
      // Increment tries for backoff
      for (const item of items) {
        if (item.seq) {
          await db.outbox.update(item.seq, { tries: item.tries + 1 })
        }
      }
      isFlushing = false
      return { success: false, pendingCount: await db.outbox.count() }
    }

    const resData = await response.json()
    const { appliedClientIds, remoteChanges, now } = resData

    // Remove applied ops from outbox and clear dirty flag
    if (appliedClientIds && Array.isArray(appliedClientIds)) {
      await db.transaction('rw', db.entries, db.outbox, db.meta, async () => {
        for (const clientId of appliedClientIds) {
          await db.outbox.where('client_id').equals(clientId).delete()
          await db.entries.where('client_id').equals(clientId).modify({ dirty: 0 })
        }

        // Apply remote changes from other devices
        if (remoteChanges && Array.isArray(remoteChanges)) {
          for (const change of remoteChanges) {
            const local = await db.entries.get(change.client_id)
            if (!local || new Date(change.updated_at) > new Date(local.updated_at)) {
              await db.entries.put({
                ...change,
                dirty: 0,
              })
            }
          }
        }

        if (now) {
          await db.meta.put({ key: 'last_pulled_at', value: now })
        }
      })
    }

    isFlushing = false
    const pending = await db.outbox.count()
    return { success: true, pendingCount: pending }
  } catch (err) {
    console.error('Outbox flush error:', err)
    isFlushing = false
    return { success: false, pendingCount: await db.outbox.count() }
  }
}
