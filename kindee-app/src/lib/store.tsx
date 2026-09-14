import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { liveQuery } from 'dexie'
import { entryKcal } from './calc'
import { foodById } from '../data/foods'
import { db } from './db'
import { deleteLocalEntry, flushOutbox, retryFailedSync, saveLocalEntry } from './sync'
import type { Entry, Meal, Profile, Session, Toast } from './types'

const KEY = 'kindee.v1'

type Persisted = {
  session: Session | null
  profile: Profile | null
  entries: Entry[]
  showMacros: boolean
  contributions: number
}

const empty: Persisted = {
  session: null,
  profile: null,
  entries: [],
  showMacros: true,
  contributions: 0,
}

function load(): Persisted {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return empty
    return { ...empty, ...(JSON.parse(raw) as Partial<Persisted>) }
  } catch {
    return empty
  }
}

export const dayKey = (offset = 0) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}

type Store = Persisted & {
  online: boolean
  toast: Toast
  pendingCount: number
  syncFailedCount: number
  retrySync: () => void
  setSession: (s: Session | null) => void
  setProfile: (p: Profile | null) => void
  setShowMacros: (v: boolean) => void
  entriesFor: (day: string) => Entry[]
  addEntry: (e: { meal: Meal; foodId: string; unitIx: number; amount: number; day?: string }) => Entry
  updateEntry: (uid: string, patch: Partial<Pick<Entry, 'unitIx' | 'amount' | 'meal'>>) => void
  removeEntry: (uid: string) => void
  addContribution: () => void
  showToast: (text: string, opts?: { undoUid?: string; entryUid?: string }) => void
  hideToast: () => void
  reset: () => void
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Persisted>(load)
  const [online, setOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true))
  const [toast, setToast] = useState<Toast>(null)
  const [outboxCount, setOutboxCount] = useState(0)
  const [syncFailedCount, setSyncFailedCount] = useState(0)
  const toastTimer = useRef<number>()

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(state))
  }, [state])

  useEffect(() => {
    const up = () => {
      setOnline(true)
      void flushOutbox()
    }
    const down = () => setOnline(false)
    const visible = () => { if (document.visibilityState === 'visible') void flushOutbox() }
    const interval = window.setInterval(() => { if (navigator.onLine) void flushOutbox() }, 30_000)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    document.addEventListener('visibilitychange', visible)
    void navigator.storage?.persist?.()
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [])

  // IndexedDB is the source of truth for entries. liveQuery also reflects remote
  // reconciliation and lets the UI stop showing "pending" after a flush.
  useEffect(() => {
    const entriesSubscription = liveQuery(() => db.entries.toArray()).subscribe({
      next: (dexieEntries) => {
        const mapped: Entry[] = dexieEntries
          .filter((d) => !d.deleted_at)
          .map((d) => ({
            uid: d.client_id,
            meal: d.meal,
            foodId: d.food_id || 'custom',
            unitIx: 0,
            amount: d.qty,
            day: d.eaten_on,
            kcal: d.kcal,
            pending: d.dirty === 1,
          }))

        setState((prev) => ({ ...prev, entries: mapped }))
      },
      error: console.error,
    })
    const outboxSubscription = liveQuery(async () => ({
      total: await db.outbox.count(),
      failed: await db.outbox.where('tries').aboveOrEqual(10).count(),
    })).subscribe({
      next: ({ total, failed }) => {
        setOutboxCount(total)
        setSyncFailedCount(failed)
      },
      error: console.error,
    })
    return () => {
      entriesSubscription.unsubscribe()
      outboxSubscription.unsubscribe()
    }
  }, [])

  useEffect(() => () => window.clearTimeout(toastTimer.current), [])

  const showToast = useCallback<Store['showToast']>((text, opts) => {
    window.clearTimeout(toastTimer.current)
    setToast({ text, ...opts })
    toastTimer.current = window.setTimeout(() => setToast(null), 4200)
  }, [])

  const hideToast = useCallback(() => {
    window.clearTimeout(toastTimer.current)
    setToast(null)
  }, [])

  const value = useMemo<Store>(() => {
    return {
      ...state,
      online,
      toast,
      pendingCount: state.session?.kind === 'account' ? outboxCount : 0,
      syncFailedCount: state.session?.kind === 'account' ? syncFailedCount : 0,
      retrySync: () => { void retryFailedSync() },
      setSession: (session) => {
        setState((s) => ({ ...s, session }))
        if (session?.kind === 'account') void flushOutbox(true)
      },
      setProfile: (profile) => setState((s) => ({ ...s, profile })),
      setShowMacros: (showMacros) => setState((s) => ({ ...s, showMacros })),
      entriesFor: (day) => state.entries.filter((e) => e.day === day),
      addEntry: (e) => {
        const uid = crypto.randomUUID()
        const day = e.day ?? dayKey()
        const entry: Entry = {
          uid,
          meal: e.meal,
          foodId: e.foodId,
          unitIx: e.unitIx,
          amount: e.amount,
          day,
          kcal: 0,
          pending: state.session?.kind === 'account',
        }
        entry.kcal = entryKcal(entry)

        // Save to Dexie IndexedDB + Outbox queue
        const food = foodById(e.foodId)
        saveLocalEntry({
          client_id: uid,
          food_id: e.foodId,
          qty: e.amount,
          meal: e.meal,
          eaten_at: new Date().toISOString(),
          eaten_on: day,
          food_name: food.name,
          kcal: entry.kcal,
          protein: food.protein * food.units[e.unitIx].f * e.amount,
          carb: food.carb * food.units[e.unitIx].f * e.amount,
          fat: food.fat * food.units[e.unitIx].f * e.amount,
          entry_source: 'search',
        }).catch(console.error)

        setState((s) => ({ ...s, entries: [...s.entries, entry] }))
        return entry
      },
      updateEntry: (uid, patch) =>
        setState((s) => ({
          ...s,
          entries: s.entries.map((e) => {
            if (e.uid !== uid) return e
            const next = { ...e, ...patch }
            const calculatedKcal = entryKcal(next)

            const food = foodById(next.foodId)
            saveLocalEntry({
              client_id: uid,
              food_id: next.foodId,
              qty: next.amount,
              meal: next.meal,
              eaten_at: new Date().toISOString(),
              eaten_on: next.day,
              food_name: food.name,
              kcal: calculatedKcal,
              protein: food.protein * food.units[next.unitIx].f * next.amount,
              carb: food.carb * food.units[next.unitIx].f * next.amount,
              fat: food.fat * food.units[next.unitIx].f * next.amount,
              entry_source: 'search',
            }).catch(console.error)

            return { ...next, kcal: calculatedKcal, pending: state.session?.kind === 'account' }
          }),
        })),
      removeEntry: (uid) => {
        deleteLocalEntry(uid).catch(console.error)
        setState((s) => ({ ...s, entries: s.entries.filter((e) => e.uid !== uid) }))
      },
      addContribution: () => setState((s) => ({ ...s, contributions: s.contributions + 1 })),
      showToast,
      hideToast,
      reset: () => setState(empty),
    }
  }, [state, online, toast, outboxCount, syncFailedCount, showToast, hideToast])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useStore ต้องอยู่ใน StoreProvider')
  return ctx
}
