import { useEffect, useState } from 'react'
import { Icon } from './components/ui'
import { foodById } from './data/foods'
import { mealForHour, mealLabel, num } from './lib/calc'
import { dayKey, useStore } from './lib/store'
import { flushOutbox } from './lib/sync'
import { supabase } from './lib/supabase'
import type { Meal, Profile } from './lib/types'
import { AddPanel } from './screens/AddPanel'
import { Auth } from './screens/Auth'
import { Calendar } from './screens/Calendar'
import { Me } from './screens/Me'
import { Overview } from './screens/Overview'
import { Onboarding } from './screens/Onboarding'
import { QtySheet } from './screens/QtySheet'
import { Today } from './screens/Today'
import { Terms } from './screens/Terms'
import { Pricing } from './screens/Pricing'

type Tab = 'overview' | 'calendar' | 'health' | 'me'
type AddTab = 'recent' | 'search' | 'manual' | 'scan' | 'photo'
type QtyTarget = { foodId: string; meal: Meal; editingUid?: string; unitIx?: number; amount?: number }

function TabBar({ tab, onTab, onAdd }: { tab: Tab; onTab: (t: Tab) => void; onAdd: () => void }) {
  const item = (id: Tab, label: string, icon: string) => (
    <button className={`kd-tab${tab === id ? ' on' : ''}`} onClick={() => onTab(id)} aria-current={tab === id}>
      <Icon name={icon} size={22} />
      {label}
    </button>
  )
  return (
    <nav className="kd-tabbar" aria-label="เมนูหลัก">
      {item('overview', 'Overview', tab === 'overview' ? 'ph-fill ph-squares-four' : 'ph ph-squares-four')}
      {item('calendar', 'Calendar', tab === 'calendar' ? 'ph-fill ph-calendar-dots' : 'ph ph-calendar-dots')}
      <button className="kd-fab" onClick={onAdd} aria-label="เพิ่มอาหาร">
        <Icon name="ph ph-plus" size={26} />
      </button>
      {item('health', 'Health', tab === 'health' ? 'ph-fill ph-heartbeat' : 'ph ph-heartbeat')}
      {item('me', 'Profile', tab === 'me' ? 'ph-fill ph-user-circle' : 'ph ph-user-circle')}
    </nav>
  )
}

export default function App() {
  const store = useStore()
  const { session, profile, setSession, setProfile, addEntry, addManualEntry, updateEntry, removeEntry, entriesFor, showToast, hideToast, toast } = store

  const [tab, setTab] = useState<Tab>('overview')
  const [dayOffset, setDayOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState<{ tab: AddTab; meal: Meal } | null>(null)
  const [qty, setQty] = useState<QtyTarget | null>(null)
  const [editTarget, setEditTarget] = useState(false)
  const [legalOpen, setLegalOpen] = useState<'terms' | 'privacy' | null>(null)
  const [pricingOpen, setPricingOpen] = useState(() => new URLSearchParams(window.location.search).has('billing'))

  const persistCloudProfile = async (p: Profile, userId = session?.kind === 'account' ? session.userId : undefined) => {
    if (!userId || !supabase) return
    const birthDate = `${p.bYear}-${String(p.bMonth).padStart(2, '0')}-${String(p.bDay).padStart(2, '0')}`
    const [{ error: profileError }, { error: weightError }] = await Promise.all([
      supabase.from('profiles').upsert({
        id: userId, sex: p.sex, birth_date: birthDate, height_cm: p.height,
        activity: p.activity, goal: p.goal, target_kcal: p.target,
        target_source: p.targetSource, show_macros: store.showMacros,
      }),
      supabase.from('weight_logs').upsert({
        user_id: userId, weight_kg: p.weight, logged_on: new Date().toISOString().slice(0, 10),
      }, { onConflict: 'user_id,logged_on' }),
    ])
    if (profileError || weightError) {
      console.error('Cloud profile save failed', profileError ?? weightError)
      showToast('บันทึกข้อมูลส่วนตัวขึ้นคลาวด์ไม่สำเร็จ เครื่องอื่นอาจต้องกรอกใหม่')
    }
  }

  useEffect(() => {
    const t = window.setTimeout(() => setLoading(false), 600)
    return () => window.clearTimeout(t)
  }, [])

  if (!session) {
    return (
      <>
        <Auth
          onGuest={() => setSession({ kind: 'guest', onboarded: Boolean(profile) })}
          onSignedIn={({ email, userId, profile: cloudProfile }) => {
            if (cloudProfile) setProfile(cloudProfile)
            // Profile filled in as a guest was never uploaded; back it up so other devices skip onboarding.
            else if (profile) void persistCloudProfile(profile, userId)
            setSession({ kind: 'account', email, userId, onboarded: Boolean(cloudProfile || profile) })
            void flushOutbox(true)
          }}
        />
        {/* Auth validation and sign-up errors are reported through toasts. */}
        {toast && (
          <div className="kd-toast kd-anim-up" role="status">
            <span style={{ flex: 1 }}>{toast.text}</span>
          </div>
        )}
      </>
    )
  }

  if (!profile || !session.onboarded) {
    return (
      <Onboarding
        initial={profile}
        onDone={(p: Profile) => {
          setProfile(p)
          setSession({ ...session, onboarded: true })
          void persistCloudProfile(p)
          showToast(`เริ่มได้เลย เป้าวันละ ${num(p.target)} kcal`)
        }}
      />
    )
  }

  if (legalOpen) {
    return <Terms initialTab={legalOpen} onBack={() => setLegalOpen(null)} />
  }

  if (pricingOpen) {
    return <Pricing session={session} onBack={() => setPricingOpen(false)} onRequireAccount={() => setSession(null)} />
  }

  if (editTarget) {
    return (
      <Onboarding
        initial={profile}
        editMode
        onCancel={() => setEditTarget(false)}
        onDone={(p) => {
          setProfile(p)
          void persistCloudProfile(p)
          setEditTarget(false)
          showToast(`อัปเดตเป้าเป็น ${num(p.target)} kcal แล้ว`)
        }}
      />
    )
  }

  const today = dayKey(dayOffset)
  const mealTotal = (m: Meal) =>
    entriesFor(today).filter((e) => e.meal === m).reduce((s, e) => s + e.kcal, 0)

  const openAdd = (t: AddTab = 'recent', meal?: Meal) =>
    setAddOpen({ tab: t, meal: meal ?? mealForHour(new Date().getHours()) })

  const quickAdd = (foodId: string, meal: Meal) => {
    const e = addEntry({ meal, foodId, unitIx: 0, amount: 1, day: today })
    setAddOpen(null)
    showToast(`เพิ่ม ${foodById(foodId).name} ลงมื้อ${mealLabel(meal)}แล้ว`, { undoUid: e.uid, entryUid: e.uid })
  }

  return (
    <>
      {tab === 'overview' && <Overview onOpenHealth={() => { setDayOffset(0); setTab('health') }} onAdd={() => { setDayOffset(0); openAdd('recent') }} />}
      {tab === 'health' && (
        <Today
          dayOffset={dayOffset}
          onDayChange={setDayOffset}
          onAdd={(m) => openAdd('recent', m)}
          onScan={() => openAdd('scan')}
          onEditEntry={(uid) => {
            const e = entriesFor(today).find((x) => x.uid === uid)
            if (e) setQty({ foodId: e.foodId, meal: e.meal, editingUid: uid, unitIx: e.unitIx, amount: e.amount })
          }}
          loading={loading}
        />
      )}
      {tab === 'calendar' && (
        <Calendar
          onOpenDay={(day) => {
            const selected = new Date(`${day}T12:00:00`)
            const current = new Date(`${dayKey()}T12:00:00`)
            setDayOffset(Math.round((selected.getTime() - current.getTime()) / 86_400_000))
            setTab('health')
          }}
        />
      )}
      {tab === 'me' && <Me onEditTarget={() => setEditTarget(true)} onOpenLegal={setLegalOpen} onOpenPricing={() => setPricingOpen(true)} />}

      <TabBar tab={tab} onTab={setTab} onAdd={() => { setDayOffset(0); openAdd('recent') }} />

      {addOpen && (
        <AddPanel
          initialTab={addOpen.tab}
          initialMeal={addOpen.meal}
          onClose={() => setAddOpen(null)}
          onPickFood={(foodId, meal) => setQty({ foodId, meal })}
          onQuickAdd={quickAdd}
          onManualAdd={(manualEntry) => {
            const entry = addManualEntry({ ...manualEntry, day: dayKey() })
            setAddOpen(null)
            showToast(`จด ${manualEntry.name} แล้ว ${num(entry.kcal)} kcal`, { undoUid: entry.uid })
          }}
          onQuickAddMany={(ids, meal) => {
            ids.forEach((id) => addEntry({ meal, foodId: id, unitIx: 0, amount: 1, day: today }))
            setAddOpen(null)
            showToast(`บันทึกทั้งมื้อ${mealLabel(meal)}แล้ว ${ids.length} รายการ`)
          }}
        />
      )}

      {qty && (
        <QtySheet
          foodId={qty.foodId}
          meal={qty.meal}
          mealTotal={mealTotal(qty.meal)}
          editing={!!qty.editingUid}
          initialUnitIx={qty.unitIx}
          initialAmount={qty.amount}
          onClose={() => setQty(null)}
          onDelete={() => {
            if (qty.editingUid) removeEntry(qty.editingUid)
            setQty(null)
            showToast('ลบรายการแล้ว')
          }}
          onSave={(unitIx, amount) => {
            if (qty.editingUid) {
              updateEntry(qty.editingUid, { unitIx, amount })
              setQty(null)
              showToast('บันทึกการแก้ไขแล้ว')
              return
            }
            const e = addEntry({ meal: qty.meal, foodId: qty.foodId, unitIx, amount, day: today })
            setQty(null)
            setAddOpen(null)
            showToast(`เพิ่ม ${foodById(qty.foodId).name} ลงมื้อ${mealLabel(qty.meal)}แล้ว`, {
              undoUid: e.uid,
              entryUid: e.uid,
            })
          }}
        />
      )}

      {toast && (
        <div className="kd-toast kd-anim-up" role="status">
          <Icon name="ph-fill ph-check-circle" size={20} color="#b5abfc" />
          <span style={{ flex: 1 }}>{toast.text}</span>
          {toast.entryUid && (
            <button
              className="kd-toast-edit"
              onClick={() => {
                const e = entriesFor(today).find((x) => x.uid === toast.entryUid)
                if (e) setQty({ foodId: e.foodId, meal: e.meal, editingUid: e.uid, unitIx: e.unitIx, amount: e.amount })
                hideToast()
              }}
            >
              แก้ไข
            </button>
          )}
          {toast.undoUid && (
            <button
              className="kd-toast-undo"
              onClick={() => {
                removeEntry(toast.undoUid!)
                hideToast()
              }}
            >
              เลิกทำ
            </button>
          )}
        </div>
      )}
    </>
  )
}
