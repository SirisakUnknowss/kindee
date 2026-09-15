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
import { History } from './screens/History'
import { Me } from './screens/Me'
import { Onboarding } from './screens/Onboarding'
import { QtySheet } from './screens/QtySheet'
import { Today } from './screens/Today'
import { Terms } from './screens/Terms'

type Tab = 'today' | 'history' | 'me'
type AddTab = 'recent' | 'search' | 'scan' | 'photo'
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
      {item('today', 'วันนี้', tab === 'today' ? 'ph-fill ph-house' : 'ph ph-house')}
      {item('history', 'วิเคราะห์', tab === 'history' ? 'ph-fill ph-chart-donut' : 'ph ph-chart-donut')}
      {item('me', 'ฉัน', 'ph ph-user-circle')}
      {/* ปุ่มเพิ่มลอยเหนือแถบเมนู ไม่กินพื้นที่ของสามแท็บหลัก */}
      <button className="kd-fab" onClick={onAdd} aria-label="เพิ่มอาหาร">
        <Icon name="ph ph-plus" size={26} />
      </button>
    </nav>
  )
}

export default function App() {
  const store = useStore()
  const { session, profile, setSession, setProfile, addEntry, updateEntry, removeEntry, entriesFor, showToast, hideToast, toast } = store

  const [tab, setTab] = useState<Tab>('today')
  const [dayOffset, setDayOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState<{ tab: AddTab; meal: Meal } | null>(null)
  const [qty, setQty] = useState<QtyTarget | null>(null)
  const [editTarget, setEditTarget] = useState(false)
  const [legalOpen, setLegalOpen] = useState<'terms' | 'privacy' | null>(null)

  const persistCloudProfile = (p: Profile) => {
    if (session?.kind !== 'account' || !supabase) return
    const birthDate = `${p.bYear}-${String(p.bMonth).padStart(2, '0')}-${String(p.bDay).padStart(2, '0')}`
    void supabase.from('profiles').upsert({
      id: session.userId, sex: p.sex, birth_date: birthDate, height_cm: p.height,
      activity: p.activity, goal: p.goal, target_kcal: p.target,
      target_source: p.targetSource, show_macros: store.showMacros,
    })
    void supabase.from('weight_logs').upsert({
      user_id: session.userId, weight_kg: p.weight, logged_on: new Date().toISOString().slice(0, 10),
    }, { onConflict: 'user_id,logged_on' })
  }

  useEffect(() => {
    const t = window.setTimeout(() => setLoading(false), 600)
    return () => window.clearTimeout(t)
  }, [])

  if (!session) {
    return (
      <Auth
        onGuest={() => setSession({ kind: 'guest', onboarded: Boolean(profile) })}
        onSignedIn={({ email, userId, profile: cloudProfile }) => {
          if (cloudProfile) setProfile(cloudProfile)
          setSession({ kind: 'account', email, userId, onboarded: Boolean(cloudProfile || profile) })
          void flushOutbox(true)
        }}
      />
    )
  }

  if (!profile || !session.onboarded) {
    return (
      <Onboarding
        initial={profile}
        onDone={(p: Profile) => {
          setProfile(p)
          setSession({ ...session, onboarded: true })
          persistCloudProfile(p)
          showToast(`เริ่มได้เลย เป้าวันละ ${num(p.target)} kcal`)
        }}
      />
    )
  }

  if (legalOpen) {
    return <Terms initialTab={legalOpen} onBack={() => setLegalOpen(null)} />
  }

  if (editTarget) {
    return (
      <Onboarding
        initial={profile}
        editMode
        onCancel={() => setEditTarget(false)}
        onDone={(p) => {
          setProfile(p)
          persistCloudProfile(p)
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
      {tab === 'today' && (
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
      {tab === 'history' && (
        <History
          onOpenDay={(day) => {
            const selected = new Date(`${day}T12:00:00`)
            const current = new Date(`${dayKey()}T12:00:00`)
            setDayOffset(Math.round((selected.getTime() - current.getTime()) / 86_400_000))
            setTab('today')
          }}
        />
      )}
      {tab === 'me' && <Me onEditTarget={() => setEditTarget(true)} onOpenLegal={setLegalOpen} />}

      <TabBar tab={tab} onTab={setTab} onAdd={() => openAdd('recent')} />

      {addOpen && (
        <AddPanel
          initialTab={addOpen.tab}
          initialMeal={addOpen.meal}
          onClose={() => setAddOpen(null)}
          onPickFood={(foodId, meal) => setQty({ foodId, meal })}
          onQuickAdd={quickAdd}
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
