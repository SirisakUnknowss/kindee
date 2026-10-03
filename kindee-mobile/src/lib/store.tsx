import AsyncStorage from '@react-native-async-storage/async-storage'
import { randomUUID } from 'expo-crypto'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AppState } from 'react-native'
import { entryKcal } from './calc'
import { foodById } from '../data/foods'
import { db, hydrateDb, subscribeDb } from './db'
import { deleteFavoriteLocal, pullFavorites, saveFavoriteLocal, touchFavoriteUsage } from './favorites'
import { isOnline, subscribeOnline } from './net'
import { deleteLocalEntry, flushOutbox, retryFailedSync, saveLocalEntry } from './sync'
import type { Entry, Meal, Profile, Session, Toast } from './types'

export type FavoriteEntry = {
  uid: string
  name: string
  amount: number
  unit: string
  kcal: number
  protein?: number
  carb?: number
  fat?: number
  note?: string
  lastUsedAt: string
}

const KEY = 'kindee.v1'

type Persisted = {
  session: Session | null
  profile: Profile | null
  showMacros: boolean
  contributions: number
}

const empty: Persisted = { session: null, profile: null, showMacros: true, contributions: 0 }

export const dayKey = (offset = 0) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

type ManualInput = {
  meal: Meal; name: string; amount: number; unitLabel: string; kcal: number
  protein?: number; carb?: number; fat?: number; note?: string; day?: string
  saveAsFavorite?: boolean
}

type Store = Persisted & {
  entries: Entry[]
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
  addManualEntry: (e: ManualInput) => Entry
  addManualEntries: (items: ManualInput[]) => Entry[]
  updateEntry: (uid: string, patch: Partial<Pick<Entry, 'unitIx' | 'amount' | 'meal'>>) => void
  removeEntry: (uid: string) => void
  favorites: FavoriteEntry[]
  logFavorite: (favoriteUid: string, meal: Meal, day?: string) => Entry | null
  removeFavorite: (favoriteUid: string) => void
  addContribution: () => void
  showToast: (text: string, opts?: { undoUid?: string; entryUid?: string }) => void
  hideToast: () => void
  reset: () => void
}

const Ctx = createContext<Store | null>(null)

/** Rebuilds the UI-facing entry list from the offline database. */
function readEntries(): Entry[] {
  return Object.values(db.entries)
    .filter((d) => !d.deleted_at)
    .map((d) => ({
      uid: d.client_id,
      meal: d.meal,
      foodId: d.food_id || 'custom',
      unitIx: 0,
      amount: d.qty,
      day: d.eaten_on,
      kcal: d.kcal,
      foodName: d.food_name,
      unitLabel: d.unit_label,
      note: d.note,
      protein: d.protein,
      carb: d.carb,
      fat: d.fat,
      entrySource: d.entry_source,
      pending: d.dirty === 1,
    }))
}

function readFavorites(): FavoriteEntry[] {
  return Object.values(db.favorites)
    .filter((f) => !f.deleted_at)
    .sort((a, b) => b.last_used_at.localeCompare(a.last_used_at))
    .map((f) => ({
      uid: f.client_id, name: f.name, amount: f.amount, unit: f.unit, kcal: f.kcal,
      protein: f.protein, carb: f.carb, fat: f.fat, note: f.note, lastUsedAt: f.last_used_at,
    }))
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Persisted>(empty)
  const [ready, setReady] = useState(false)
  const [online, setOnline] = useState(isOnline())
  const [toast, setToast] = useState<Toast>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [favorites, setFavorites] = useState<FavoriteEntry[]>([])
  const [outboxCount, setOutboxCount] = useState(0)
  const [syncFailedCount, setSyncFailedCount] = useState(0)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const stateRef = useRef(state)
  stateRef.current = state

  // Restore persisted settings and the offline database before the first real render.
  useEffect(() => {
    void (async () => {
      const [raw] = await Promise.all([AsyncStorage.getItem(KEY).catch(() => null), hydrateDb()])
      if (raw) {
        try { setState({ ...empty, ...(JSON.parse(raw) as Partial<Persisted>) }) } catch { /* ignore corrupt blob */ }
      }
      setReady(true)
    })()
  }, [])

  useEffect(() => {
    if (ready) void AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {})
  }, [state, ready])

  // The offline database is the source of truth; this mirrors it into React state.
  useEffect(() => {
    const refresh = () => {
      setEntries(readEntries())
      setFavorites(readFavorites())
      setOutboxCount(db.outbox.length)
      setSyncFailedCount(db.outbox.filter((o) => o.tries >= 10).length)
    }
    refresh()
    return subscribeDb(refresh)
  }, [ready])

  useEffect(() => {
    const offNet = subscribeOnline((next) => {
      setOnline(next)
      if (next) void flushOutbox()
    })
    const appSub = AppState.addEventListener('change', (s) => { if (s === 'active') void flushOutbox() })
    const interval = setInterval(() => { if (isOnline()) void flushOutbox() }, 30_000)
    return () => { offNet(); appSub.remove(); clearInterval(interval) }
  }, [])

  useEffect(() => () => clearTimeout(toastTimer.current), [])

  const showToast = useCallback<Store['showToast']>((text, opts) => {
    clearTimeout(toastTimer.current)
    setToast({ text, ...opts })
    toastTimer.current = setTimeout(() => setToast(null), 4200)
  }, [])

  const hideToast = useCallback(() => {
    clearTimeout(toastTimer.current)
    setToast(null)
  }, [])

  const createManualEntry = useCallback((e: ManualInput): Entry => {
    const uid = randomUUID()
    const day = e.day ?? dayKey()
    const entry: Entry = {
      uid, meal: e.meal, foodId: 'custom', unitIx: 0, amount: e.amount, day,
      kcal: Math.round(e.kcal),
      foodName: e.name.trim(),
      unitLabel: e.unitLabel.trim() || 'หน่วย',
      note: e.note?.trim() || undefined,
      protein: e.protein, carb: e.carb, fat: e.fat,
      entrySource: 'manual',
      pending: stateRef.current.session?.kind === 'account',
    }
    void saveLocalEntry({
      client_id: uid, qty: e.amount, meal: e.meal, eaten_at: new Date().toISOString(), eaten_on: day,
      food_name: entry.foodName!, unit_label: entry.unitLabel, note: entry.note, kcal: entry.kcal,
      protein: e.protein, carb: e.carb, fat: e.fat, entry_source: 'manual',
    })
    if (e.saveAsFavorite) {
      void saveFavoriteLocal({
        name: entry.foodName!, amount: e.amount, unit: entry.unitLabel!, kcal: entry.kcal,
        protein: e.protein, carb: e.carb, fat: e.fat, note: entry.note,
      })
    }
    return entry
  }, [])

  const catalogEntry = (uid: string, meal: Meal, foodId: string, unitIx: number, amount: number, day: string, kcal: number) => {
    const food = foodById(foodId)
    const factor = food.units[unitIx].f * amount
    void saveLocalEntry({
      client_id: uid, food_id: foodId, qty: amount, meal, eaten_at: new Date().toISOString(), eaten_on: day,
      food_name: food.name, kcal,
      protein: food.protein * factor, carb: food.carb * factor, fat: food.fat * factor,
      entry_source: 'search',
    })
  }

  const value = useMemo<Store>(() => ({
    ...state,
    entries,
    online,
    toast,
    favorites,
    pendingCount: state.session?.kind === 'account' ? outboxCount : 0,
    syncFailedCount: state.session?.kind === 'account' ? syncFailedCount : 0,
    retrySync: () => { void retryFailedSync() },
    setSession: (session) => {
      setState((s) => ({ ...s, session }))
      if (session?.kind === 'account') {
        void flushOutbox(true)
        void pullFavorites()
      }
    },
    setProfile: (profile) => setState((s) => ({ ...s, profile })),
    setShowMacros: (showMacros) => setState((s) => ({ ...s, showMacros })),
    entriesFor: (day) => entries.filter((e) => e.day === day),
    addEntry: (e) => {
      const uid = randomUUID()
      const day = e.day ?? dayKey()
      const entry: Entry = {
        uid, meal: e.meal, foodId: e.foodId, unitIx: e.unitIx, amount: e.amount, day, kcal: 0,
        pending: state.session?.kind === 'account',
      }
      entry.kcal = entryKcal(entry)
      catalogEntry(uid, e.meal, e.foodId, e.unitIx, e.amount, day, entry.kcal)
      return entry
    },
    addManualEntry: createManualEntry,
    addManualEntries: (items) => items.map((item) => createManualEntry(item)),
    logFavorite: (favoriteUid, meal, day) => {
      const favorite = favorites.find((f) => f.uid === favoriteUid)
      if (!favorite) return null
      const entry = createManualEntry({
        meal, name: favorite.name, amount: favorite.amount, unitLabel: favorite.unit, kcal: favorite.kcal,
        protein: favorite.protein, carb: favorite.carb, fat: favorite.fat, note: favorite.note, day,
      })
      void touchFavoriteUsage(favoriteUid)
      return entry
    },
    removeFavorite: (favoriteUid) => { void deleteFavoriteLocal(favoriteUid) },
    updateEntry: (uid, patch) => {
      const current = entries.find((e) => e.uid === uid)
      if (!current) return
      const next = { ...current, ...patch }
      catalogEntry(uid, next.meal, next.foodId, next.unitIx, next.amount, next.day, entryKcal(next))
    },
    removeEntry: (uid) => { void deleteLocalEntry(uid) },
    addContribution: () => setState((s) => ({ ...s, contributions: s.contributions + 1 })),
    showToast,
    hideToast,
    reset: () => setState(empty),
  }), [state, entries, online, toast, outboxCount, syncFailedCount, favorites, showToast, hideToast, createManualEntry])

  if (!ready) return null
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useStore ต้องอยู่ใน StoreProvider')
  return ctx
}
