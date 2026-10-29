import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, type LocalEntry } from './db'
import { BACKUP_FORMAT, buildBackup, parseBackup, restoreBackup, summarize, syncableEntry } from './backup'

const entry = (over: Partial<LocalEntry> = {}): LocalEntry => ({
  client_id: '11111111-1111-4111-8111-111111111111', qty: 1, meal: 'lunch', eaten_at: '2026-10-27T05:00:00Z',
  eaten_on: '2026-10-27', food_name: 'ข้าวกะเพราไก่', kcal: 580, entry_source: 'search', deleted_at: null,
  updated_at: '2026-10-27T05:00:00Z', dirty: 0, ...over,
})

beforeEach(async () => {
  await db.transaction('rw', db.tables, async () => { await Promise.all(db.tables.map((t) => t.clear())) })
})

describe('backup', () => {
  it('round-trips entries, water and exercise and queues entries for sync', async () => {
    await db.entries.put(entry())
    await db.entries.put(entry({ client_id: '22222222-2222-4222-8222-222222222222', deleted_at: '2026-10-27T06:00:00Z' }))
    await db.water_logs.put({ day: '2026-10-27', ml: 1500, updated_at: 'x', dirty: 0 })
    await db.exercise_logs.put({ client_id: '33333333-3333-4333-8333-333333333333', done_on: '2026-10-27', name: 'วิ่ง', minutes: 30, kcal: 250, updated_at: 'x', dirty: 0 })
    const text = JSON.stringify(await buildBackup(null, { waterGoal: 2000 }))

    await db.transaction('rw', db.tables, async () => { await Promise.all(db.tables.map((t) => t.clear())) })
    const parsed = parseBackup(text)
    expect(summarize(parsed)).toMatchObject({ entries: 1, water: 1, exercises: 1, days: 1 })
    expect(parsed.settings.waterGoal).toBe(2000)

    await restoreBackup(parsed)
    expect(await db.entries.count()).toBe(1)
    expect((await db.water_logs.get('2026-10-27'))?.ml).toBe(1500)
    expect((await db.exercise_logs.toArray())[0].dirty).toBe(1)
    expect(await db.outbox.count()).toBe(1)
  })

  it('rejects files that are not KinDee backups', () => {
    expect(() => parseBackup('not json')).toThrow()
    expect(() => parseBackup(JSON.stringify({ exportFormat: 'KinDee personal data export' }))).toThrow()
    expect(() => parseBackup(JSON.stringify({ format: BACKUP_FORMAT, version: 99 }))).toThrow()
  })

  it('drops malformed rows instead of failing the whole file', () => {
    const parsed = parseBackup(JSON.stringify({ format: BACKUP_FORMAT, version: 1, entries: [entry(), { client_id: 'bad' }], water: [{ day: 'x', ml: 1 }] }))
    expect(parsed.entries).toHaveLength(1)
    expect(parsed.water).toHaveLength(0)
  })

  it('keeps old or oversized entries out of the sync queue', () => {
    const now = Date.parse('2026-10-28T00:00:00Z')
    expect(syncableEntry(entry(), now)).toBe(true)
    expect(syncableEntry(entry({ eaten_on: '2024-01-01' }), now)).toBe(false)
    expect(syncableEntry(entry({ qty: 150 }), now)).toBe(false)
  })
})
