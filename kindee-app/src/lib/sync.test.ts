import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getSession = vi.fn()
vi.mock('./supabase', () => ({
  get supabase() {
    return { auth: { getSession } }
  },
  isSupabaseConfigured: true,
}))

const { db } = await import('./db')
const { saveLocalEntry, deleteLocalEntry, flushOutbox, retryFailedSync } = await import('./sync')

const entry = (overrides: Record<string, unknown> = {}) => ({
  qty: 1,
  meal: 'lunch' as const,
  eaten_at: '2026-09-20T05:00:00.000Z',
  eaten_on: '2026-09-20',
  food_name: 'ข้าวกะเพราหมู',
  kcal: 620,
  entry_source: 'search' as const,
  ...overrides,
})

const online = (value: boolean) =>
  Object.defineProperty(globalThis.navigator, 'onLine', { value, configurable: true })

const syncResponse = (body: unknown, ok = true, status = 200) => ({
  ok,
  status,
  json: async () => body,
}) as Response

beforeEach(async () => {
  vi.restoreAllMocks()
  // saveLocalEntry kicks off a background flush, so let it settle before the
  // next test clears the tables; deleting the database mid-flush throws.
  await flushOutbox(true).catch(() => undefined)
  if (!db.isOpen()) await db.open()
  await Promise.all([db.entries.clear(), db.outbox.clear(), db.meta.clear()])
  online(true)
  getSession.mockResolvedValue({ data: { session: { access_token: 'token' } } })
})

afterEach(async () => {
  // saveLocalEntry starts a fire-and-forget flush. Let it finish while this
  // test's fetch mock is still installed so it cannot leak into the next test.
  await flushOutbox(true).catch(() => undefined)
})

describe('saveLocalEntry', () => {
  it('stores the entry and queues one outbox item', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => syncResponse({ applied: [], changes: [], now: '' })))
    const saved = await saveLocalEntry(entry())

    expect(saved.dirty).toBe(1)
    expect(await db.entries.get(saved.client_id)).toBeTruthy()
    const queued = await db.outbox.toArray()
    expect(queued).toHaveLength(1)
    expect(queued[0].op).toBe('insert')
  })

  it('replaces the queued item when the same entry is edited again', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => syncResponse({ applied: [], changes: [], now: '' })))
    const saved = await saveLocalEntry(entry())
    await saveLocalEntry({ ...entry({ kcal: 300 }), client_id: saved.client_id })

    const queued = await db.outbox.toArray()
    expect(queued).toHaveLength(1)
    expect(queued[0].payload.kcal).toBe(300)
    expect(queued[0].op).toBe('update')
  })

  it('queues a delete that keeps the row until the server confirms', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => syncResponse({ applied: [], changes: [], now: '' })))
    const saved = await saveLocalEntry(entry())
    await db.outbox.clear()
    await deleteLocalEntry(saved.client_id)

    const stored = await db.entries.get(saved.client_id)
    expect(stored?.deleted_at).toBeTruthy()
    expect((await db.outbox.toArray())[0].op).toBe('delete')
  })
})

describe('flushOutbox', () => {
  it('does not send anything while offline and keeps the queue', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    online(false)
    await saveLocalEntry(entry())

    const result = await flushOutbox()

    expect(result).toMatchObject({ success: false, reason: 'offline', pendingCount: 1 })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(await db.outbox.count()).toBe(1)
  })

  it('keeps the queue for a guest so data is not lost before sign-in', async () => {
    vi.stubGlobal('fetch', vi.fn())
    getSession.mockResolvedValue({ data: { session: null } })
    await saveLocalEntry(entry())

    const result = await flushOutbox()

    expect(result.reason).toBe('guest')
    expect(await db.outbox.count()).toBe(1)
  })

  it('clears confirmed items, marks them synced and stores the pull cursor', async () => {
    let sentBody: any = null
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      sentBody = JSON.parse(String(init.body))
      return syncResponse({
        applied: sentBody.ops.map((op: any) => op.client_id),
        changes: [],
        now: '2026-09-20T06:00:00.000Z',
      })
    }))
    const saved = await saveLocalEntry(entry())

    const result = await flushOutbox(true)

    expect(result.success).toBe(true)
    expect(await db.outbox.count()).toBe(0)
    expect((await db.entries.get(saved.client_id))?.dirty).toBe(0)
    expect((await db.meta.get('last_pulled_at'))?.value).toBe('2026-09-20T06:00:00.000Z')
    expect(sentBody.ops).toHaveLength(1)
  })

  it('keeps an unconfirmed item queued so it is retried', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => syncResponse({ applied: [], changes: [], now: '' })))
    const saved = await saveLocalEntry(entry())

    await flushOutbox(true)

    expect(await db.outbox.count()).toBe(1)
    expect((await db.entries.get(saved.client_id))?.dirty).toBe(1)
  })

  it('records the server error code and backs off instead of dropping the item', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => syncResponse({ error: { code: 'conflict' } }, false, 409)))
    await saveLocalEntry(entry())

    const result = await flushOutbox(true)

    expect(result.reason).toBe('server')
    const [queued] = await db.outbox.toArray()
    expect(queued.tries).toBe(1)
    expect(queued.last_error).toBe('conflict')
    expect(Date.parse(queued.next_attempt_at!)).toBeGreaterThan(Date.now())
  })

  it('treats a thrown fetch as offline and counts a try', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down') }))
    await saveLocalEntry(entry())

    const result = await flushOutbox(true)

    expect(result.reason).toBe('offline')
    expect((await db.outbox.toArray())[0].last_error).toBe('network_error')
  })

  it('applies remote changes but never overwrites a dirty local entry', async () => {
    const remoteWinsOver = {
      ...entry({ food_name: 'จากเครื่องอื่น', kcal: 100 }),
      client_id: 'remote-1',
      updated_at: '2026-09-21T00:00:00.000Z',
      dirty: 0,
    }
    // The local copy is older and already synced, so the server version wins.
    await db.entries.put({ ...remoteWinsOver, food_name: 'ของเก่า', kcal: 999, updated_at: '2026-09-20T00:00:00.000Z' })
    const dirtyLocal = {
      ...entry({ food_name: 'ยังไม่ซิงก์', kcal: 500 }),
      client_id: 'local-1',
      updated_at: '2026-09-19T00:00:00.000Z',
      dirty: 1,
    }
    await db.entries.put(dirtyLocal)

    vi.stubGlobal('fetch', vi.fn(async () => syncResponse({
      applied: [],
      changes: [remoteWinsOver, { ...dirtyLocal, food_name: 'เซิร์ฟเวอร์ทับ', updated_at: '2026-09-22T00:00:00.000Z' }],
      now: '2026-09-22T00:00:00.000Z',
    })))
    await saveLocalEntry(entry())

    await flushOutbox(true)

    expect((await db.entries.get('remote-1'))?.food_name).toBe('จากเครื่องอื่น')
    expect((await db.entries.get('local-1'))?.food_name).toBe('ยังไม่ซิงก์')
  })

  it('runs one flush at a time', async () => {
    const fetchMock = vi.fn(async () => syncResponse({ applied: [], changes: [], now: '' }))
    vi.stubGlobal('fetch', fetchMock)
    await saveLocalEntry(entry())
    fetchMock.mockClear()

    await Promise.all([flushOutbox(true), flushOutbox(true)])

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('retryFailedSync', () => {
  it('resets exhausted items so a tester can retry by hand', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => syncResponse({ applied: [], changes: [], now: '' })))
    const saved = await saveLocalEntry(entry())
    const [queued] = await db.outbox.toArray()
    await db.outbox.update(queued.seq!, { tries: 10, last_error: 'http_500' })

    await retryFailedSync()

    const [after] = await db.outbox.where('client_id').equals(saved.client_id).toArray()
    expect(after?.tries ?? 0).toBeLessThan(10)
  })
})
