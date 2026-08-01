import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { entryKcal } from './calc'
import type { Entry, Meal, Profile, Session, Toast } from './types'

/**
 * Offline-first: เขียนลงเครื่องก่อนเสมอ แล้วค่อยซิงก์
 * ตอนนี้ persist ด้วย localStorage — ของจริงควรเป็น IndexedDB (Dexie) + outbox queue
 * และ upsert ฝั่ง server ด้วย uid (client_id) เพื่อให้ idempotent
 */
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
  const [online, setOnline] = useState(() => navigator.onLine)
  const [toast, setToast] = useState<Toast>(null)
  const toastTimer = useRef<number>()

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(state))
  }, [state])

  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])

  // กลับมาออนไลน์ = ส่ง outbox แล้วเคลียร์ธง pending
  useEffect(() => {
    if (!online) return
    const t = window.setTimeout(() => {
      setState((s) =>
        s.entries.some((e) => e.pending)
          ? { ...s, entries: s.entries.map((e) => ({ ...e, pending: false })) }
          : s,
      )
    }, 900)
    return () => window.clearTimeout(t)
  }, [online])

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
        const entry: Entry = {
          uid: crypto.randomUUID(),
          meal: e.meal,
          foodId: e.foodId,
          unitIx: e.unitIx,
          amount: e.amount,
          day: e.day ?? dayKey(),
          kcal: 0,
          pending: !onlineNow,
        }
        entry.kcal = entryKcal(entry)
        setState((s) => ({ ...s, entries: [...s.entries, entry] }))
        return entry
      },
      updateEntry: (uid, patch) =>
        setState((s) => ({
          ...s,
          entries: s.entries.map((e) => {
            if (e.uid !== uid) return e
            const next = { ...e, ...patch }
            return { ...next, kcal: entryKcal(next), pending: !onlineNow }
          }),
        })),
      removeEntry: (uid) => setState((s) => ({ ...s, entries: s.entries.filter((e) => e.uid !== uid) })),
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
