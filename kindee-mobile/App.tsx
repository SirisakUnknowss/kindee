import { StatusBar } from 'expo-status-bar'
import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Icon, Toast } from './src/components/ui'
import { foodById } from './src/data/foods'
import { mealForHour, mealLabel, num } from './src/lib/calc'
import { installErrorReporting } from './src/lib/report'
import { StoreProvider, dayKey, useStore } from './src/lib/store'
import { flushOutbox } from './src/lib/sync'
import { supabase } from './src/lib/supabase'
import type { Meal, Profile } from './src/lib/types'
import { AddPanel, type AddTab } from './src/screens/AddPanel'
import { Auth } from './src/screens/Auth'
import { Calendar } from './src/screens/Calendar'
import { Me } from './src/screens/Me'
import { Onboarding } from './src/screens/Onboarding'
import { Overview } from './src/screens/Overview'
import { QtySheet } from './src/screens/QtySheet'
import { Terms } from './src/screens/Terms'
import { Today } from './src/screens/Today'
import { C, shadow } from './src/theme'

installErrorReporting()

type Tab = 'overview' | 'calendar' | 'health' | 'me'
type QtyTarget = { foodId: string; meal: Meal; editingUid?: string; unitIx?: number; amount?: number }

function TabBar({ tab, onTab, onAdd }: { tab: Tab; onTab: (t: Tab) => void; onAdd: () => void }) {
  const insets = useSafeAreaInsets()
  const item = (id: Tab, label: string, icon: string, filled: string) => (
    <Pressable key={id} onPress={() => onTab(id)} accessibilityRole="tab" accessibilityState={{ selected: tab === id }} style={{ flex: 1, alignItems: 'center', gap: 2, paddingTop: 8 }}>
      <Icon name={tab === id ? filled : icon} size={22} color={tab === id ? C.accentPressed : C.muted} />
      <Text style={{ fontSize: 11, color: tab === id ? C.accentPressed : C.muted, fontWeight: tab === id ? '500' : '400' }}>{label}</Text>
    </Pressable>
  )
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'flex-start', backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border, paddingBottom: Math.max(insets.bottom, 8), minHeight: 62 }} accessibilityRole="tablist">
      {item('overview', 'Overview', 'ph ph-squares-four', 'ph-fill ph-squares-four')}
      {item('calendar', 'Calendar', 'ph ph-calendar-dots', 'ph-fill ph-calendar-dots')}
      <View style={{ width: 76, alignItems: 'center' }}>
        <Pressable onPress={onAdd} accessibilityRole="button" accessibilityLabel="เพิ่มอาหาร"
          style={[{ width: 56, height: 56, borderRadius: 28, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', marginTop: -22 }, shadow.fab]}>
          <Icon name="ph ph-plus" size={26} color="#fff" />
        </Pressable>
      </View>
      {item('health', 'Health', 'ph ph-heartbeat', 'ph-fill ph-heartbeat')}
      {item('me', 'Profile', 'ph ph-user-circle', 'ph-fill ph-user-circle')}
    </View>
  )
}

function Root() {
  const store = useStore()
  const { session, profile, setSession, setProfile, addEntry, addManualEntry, addManualEntries, updateEntry, removeEntry, entriesFor, showToast, hideToast, toast } = store

  const [tab, setTab] = useState<Tab>('overview')
  const [dayOffset, setDayOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState<{ tab: AddTab; meal: Meal } | null>(null)
  const [qty, setQty] = useState<QtyTarget | null>(null)
  const [editTarget, setEditTarget] = useState(false)
  const [legalOpen, setLegalOpen] = useState<'terms' | 'privacy' | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 600)
    return () => clearTimeout(t)
  }, [])

  const persistCloudProfile = async (p: Profile, userId = session?.kind === 'account' ? session.userId : undefined) => {
    if (!userId || !supabase) return
    const birthDate = `${p.bYear}-${String(p.bMonth).padStart(2, '0')}-${String(p.bDay).padStart(2, '0')}`
    const [{ error: profileError }, { error: weightError }] = await Promise.all([
      supabase.from('profiles').upsert({
        id: userId, sex: p.sex, birth_date: birthDate, height_cm: p.height,
        activity: p.activity, goal: p.goal, target_kcal: p.target,
        target_source: p.targetSource, show_macros: store.showMacros,
      }),
      supabase.from('weight_logs').upsert(
        { user_id: userId, weight_kg: p.weight, logged_on: new Date().toISOString().slice(0, 10) },
        { onConflict: 'user_id,logged_on' },
      ),
    ])
    if (profileError || weightError) {
      console.warn('Cloud profile save failed', profileError ?? weightError)
      showToast('บันทึกข้อมูลส่วนตัวขึ้นคลาวด์ไม่สำเร็จ เครื่องอื่นอาจต้องกรอกใหม่')
    }
  }

  if (!session) {
    return (
      <>
        <Auth
          onGuest={() => setSession({ kind: 'guest', onboarded: Boolean(profile) })}
          onSignedIn={({ email, userId, profile: cloudProfile }) => {
            if (cloudProfile) setProfile(cloudProfile)
            // A profile filled in as a guest was never uploaded; back it up so other devices skip onboarding.
            else if (profile) void persistCloudProfile(profile, userId)
            setSession({ kind: 'account', email, userId, onboarded: Boolean(cloudProfile || profile) })
            void flushOutbox(true)
          }}
        />
        {toast && <Toast text={toast.text} />}
      </>
    )
  }

  if (!profile || !session.onboarded) {
    return (
      <Onboarding
        initial={profile}
        onDone={(p) => {
          setProfile(p)
          setSession({ ...session, onboarded: true })
          void persistCloudProfile(p)
          showToast(`เริ่มได้เลย เป้าวันละ ${num(p.target)} kcal`)
        }}
      />
    )
  }

  if (legalOpen) return <Terms initialTab={legalOpen} onBack={() => setLegalOpen(null)} />

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
  const mealTotal = (m: Meal) => entriesFor(today).filter((e) => e.meal === m).reduce((s, e) => s + e.kcal, 0)
  const openAdd = (t: AddTab = 'recent', meal?: Meal) => setAddOpen({ tab: t, meal: meal ?? mealForHour(new Date().getHours()) })
  const editEntry = (uid: string) => {
    const e = entriesFor(today).find((x) => x.uid === uid)
    if (e) setQty({ foodId: e.foodId, meal: e.meal, editingUid: uid, unitIx: e.unitIx, amount: e.amount })
  }

  const quickAdd = (foodId: string, meal: Meal) => {
    const e = addEntry({ meal, foodId, unitIx: 0, amount: 1, day: today })
    setAddOpen(null)
    showToast(`เพิ่ม ${foodById(foodId).name} ลงมื้อ${mealLabel(meal)}แล้ว`, { undoUid: e.uid, entryUid: e.uid })
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {tab === 'overview' && <Overview onOpenHealth={() => { setDayOffset(0); setTab('health') }} onAdd={() => { setDayOffset(0); openAdd('recent') }} />}
      {tab === 'health' && (
        <Today dayOffset={dayOffset} onDayChange={setDayOffset} onAdd={(m) => openAdd('recent', m)} onScan={() => openAdd('scan')} onEditEntry={editEntry} loading={loading} />
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
      {tab === 'me' && <Me onEditTarget={() => setEditTarget(true)} onOpenLegal={setLegalOpen} />}

      <TabBar tab={tab} onTab={setTab} onAdd={() => { setDayOffset(0); openAdd('recent') }} />

      {addOpen && (
        <AddPanel
          initialTab={addOpen.tab}
          initialMeal={addOpen.meal}
          onClose={() => setAddOpen(null)}
          onPickFood={(foodId, meal) => setQty({ foodId, meal })}
          onQuickAdd={quickAdd}
          onManualAdd={(m) => {
            const entry = addManualEntry({ ...m, day: dayKey() })
            setAddOpen(null)
            showToast(`จด ${m.name} แล้ว ${num(entry.kcal)} kcal`, { undoUid: entry.uid })
          }}
          onManualAddMany={(items) => {
            const day = dayKey()
            const added = addManualEntries(items.map((item) => ({ ...item, day })))
            setAddOpen(null)
            showToast(`บันทึก ${added.length} รายการแล้ว รวม ${num(added.reduce((s, e) => s + e.kcal, 0))} kcal`)
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
            showToast(`เพิ่ม ${foodById(qty.foodId).name} ลงมื้อ${mealLabel(qty.meal)}แล้ว`, { undoUid: e.uid, entryUid: e.uid })
          }}
        />
      )}

      {toast && (
        <Toast
          text={toast.text}
          onEdit={toast.entryUid ? () => { editEntry(toast.entryUid!); hideToast() } : undefined}
          onUndo={toast.undoUid ? () => { removeEntry(toast.undoUid!); hideToast() } : undefined}
        />
      )}
    </View>
  )
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <StoreProvider>
        <Root />
      </StoreProvider>
    </SafeAreaProvider>
  )
}
