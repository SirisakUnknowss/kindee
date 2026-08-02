import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { entryKcal } from './calc'
import { db } from './db'
import { deleteLocalEntry, flushOutbox, saveLocalEntry } from './sync'
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
  const toastTimer = useRef<number>()

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(state))
  }, [state])

  useEffect(() => {
    const up = () => {
      setOnline(true)
      flushOutbox().catch(console.error)
    }
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])

  // Sync Dexie to state on mount
  useEffect(() => {
    db.entries.toArray().then((dexieEntries) => {
      if (dexieEntries && dexieEntries.length > 0) {
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

        setState((prev) => ({
          ...prev,
          entries: mapped,
        }))
      }
    })
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
    const onlineNow = online
    return {
      ...state,
      online,
      toast,
      pendingCount: state.entries.filter((e) => e.pending).length,
      setSession: (session) => setState((s) => ({ ...s, session })),
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
          pending: !onlineNow,
        }
        entry.kcal = entryKcal(entry)

        // Save to Dexie IndexedDB + Outbox queue
        saveLocalEntry({
          client_id: uid,
          food_id: e.foodId,
          qty: e.amount,
          meal: e.meal,
          eaten_at: new Date().toISOString(),
          eaten_on: day,
          food_name: e.foodId,
          kcal: entry.kcal,
          entry_source: 'manual',
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

            saveLocalEntry({
              client_id: uid,
              food_id: next.foodId,
              qty: next.amount,
              meal: next.meal,
              eaten_at: new Date().toISOString(),
              eaten_on: next.day,
              food_name: next.foodId,
              kcal: calculatedKcal,
              entry_source: 'manual',
            }).catch(console.error)

            return { ...next, kcal: calculatedKcal, pending: !onlineNow }
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
  }, [state, online, toast, showToast, hideToast])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useStore ต้องอยู่ใน StoreProvider')
  return ctx
}
