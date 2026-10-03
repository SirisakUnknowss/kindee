import Slider from '@react-native-community/slider'
import { useEffect, useMemo, useState } from 'react'
import { FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button, Card, Field, Icon, IconButton, Row, Screen, Sheet, TextButton } from '../components/ui'
import { legalConfig } from '../config/legal'
import { TDEE_EXPLAINER } from '../content/tdee'
import { ACTIVITY, GOALS, computeTarget, num } from '../lib/calc'
import type { Profile } from '../lib/types'
import { C, R, T } from '../theme'

const MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
const YEARS = Array.from({ length: 2008 - 1970 + 1 }, (_, i) => 2008 - i)
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1)

const DEFAULT: Profile = {
  sex: 'female', bDay: 15, bMonth: 6, bYear: 1995, height: 165, weight: 60,
  activity: 'light', goal: 'keep', target: 1850, targetSource: 'auto',
}

function PickerField({ label, value, options, onChange, flex }: {
  label: string
  value: number
  options: { value: number; label: string }[]
  onChange: (v: number) => void
  flex: number
}) {
  const [open, setOpen] = useState(false)
  const current = options.find((o) => o.value === value)
  return (
    <View style={{ flex }}>
      <Text style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current?.label}`}
        style={{ minHeight: 52, borderRadius: R.btn, borderWidth: 1, borderColor: C.borderStrong, backgroundColor: C.surface, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <Text style={[{ fontSize: 14.5, color: C.text }, T.tnum]}>{current?.label}</Text>
        <Icon name="ph ph-caret-right" size={16} color={C.muted} style={{ transform: [{ rotate: '90deg' }] }} />
      </Pressable>
      {open ? (
        <Sheet onClose={() => setOpen(false)}>
          <Text style={[T.h2, { marginBottom: 8 }]}>{label}</Text>
          <FlatList
            style={{ maxHeight: 360 }}
            data={options}
            keyExtractor={(o) => String(o.value)}
            initialScrollIndex={Math.max(0, options.findIndex((o) => o.value === value) - 2)}
            getItemLayout={(_, index) => ({ length: 48, offset: 48 * index, index })}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => { onChange(item.value); setOpen(false) }}
                style={{ height: 48, justifyContent: 'center', paddingHorizontal: 8, borderRadius: 10, backgroundColor: item.value === value ? C.accentTint : undefined }}
              >
                <Text style={{ fontSize: 15.5, color: item.value === value ? C.onTint : C.text, fontWeight: item.value === value ? '500' : '400' }}>{item.label}</Text>
              </Pressable>
            )}
          />
        </Sheet>
      ) : null}
    </View>
  )
}

function SliderField({ label, unit, min, max, step, value, onChange }: {
  label: string; unit: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void
}) {
  const [draft, setDraft] = useState(String(value))
  const [editing, setEditing] = useState(false)

  useEffect(() => { if (!editing) setDraft(String(value)) }, [value, editing])

  const commit = () => {
    setEditing(false)
    const parsed = Number(draft)
    if (draft.trim() === '' || !Number.isFinite(parsed)) return setDraft(String(value))
    const decimals = String(step).split('.')[1]?.length ?? 0
    const clamped = Math.min(max, Math.max(min, parsed))
    const next = Number((Math.round(clamped / step) * step).toFixed(decimals))
    onChange(next)
    setDraft(String(next))
  }

  return (
    <View>
      <Row style={{ justifyContent: 'space-between', gap: 12 }}>
        <Text style={{ fontSize: 12, color: C.muted }}>{label}</Text>
        <Row style={{ gap: 6 }}>
          <TextInput
            style={[{ width: 84, minHeight: 48, textAlign: 'right', paddingHorizontal: 10, borderRadius: R.btn, borderWidth: 1, borderColor: C.borderStrong, backgroundColor: C.surface, color: C.text, fontSize: 16 }, T.tnum]}
            keyboardType="decimal-pad"
            value={draft}
            accessibilityLabel={`${label} (${unit})`}
            onFocus={() => setEditing(true)}
            onChangeText={(next) => {
              setDraft(next)
              const parsed = Number(next)
              if (next !== '' && Number.isFinite(parsed) && parsed >= min && parsed <= max) onChange(parsed)
            }}
            onBlur={commit}
            onSubmitEditing={commit}
          />
          <Text style={[T.label, T.muted]}>{unit}</Text>
        </Row>
      </Row>
      <Slider
        style={{ height: 44, marginTop: 4 }}
        minimumValue={min} maximumValue={max} step={step} value={value}
        minimumTrackTintColor={C.accent} maximumTrackTintColor={C.border} thumbTintColor={C.accent}
        onValueChange={(v) => { setEditing(false); setDraft(String(Number(v.toFixed(1)))); onChange(Number(v.toFixed(1))) }}
        accessibilityLabel={label}
      />
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={[T.caption, T.muted, T.tnum]}>{min}</Text>
        <Text style={[T.caption, T.muted, T.tnum]}>{max}</Text>
      </Row>
    </View>
  )
}

function OptionCard({ on, onPress, icon, title, desc }: { on: boolean; onPress: () => void; icon: string; title: string; desc: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 68, padding: 14, borderRadius: R.card, borderWidth: on ? 1.5 : 1, borderColor: on ? C.accent : C.border, backgroundColor: on ? C.accentTintSoft : C.surface }}
    >
      <Icon name={icon} size={24} color={C.accentPressed} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, color: C.text }}>{title}</Text>
        <Text style={[T.label, T.muted]}>{desc}</Text>
      </View>
      <Icon name={on ? 'ph-fill ph-check-circle' : 'ph ph-circle'} size={22} color={on ? C.accent : C.borderStrong} />
    </Pressable>
  )
}

export function Onboarding({ initial, editMode, onDone, onCancel }: {
  initial?: Profile | null
  editMode?: boolean
  onDone: (p: Profile) => void
  onCancel?: () => void
}) {
  const insets = useSafeAreaInsets()
  const [p, setP] = useState<Profile>(initial ?? DEFAULT)
  const [step, setStep] = useState(editMode ? 5 : 1)
  const [manualOpen, setManualOpen] = useState(initial?.targetSource === 'manual')
  const [manual, setManual] = useState(initial?.targetSource === 'manual' ? String(initial.target) : '')
  const [ageRestricted, setAgeRestricted] = useState(false)
  const [explainerOpen, setExplainerOpen] = useState(false)

  const calc = useMemo(() => computeTarget(p), [p])
  const target = manualOpen && Number(manual) > 0 ? Math.round(Number(manual)) : calc.target
  const source: Profile['targetSource'] = manualOpen && Number(manual) > 0 ? 'manual' : 'auto'
  const set = (patch: Partial<Profile>) => setP((v) => ({ ...v, ...patch }))

  const next = () => {
    if (!editMode && step === 1 && calc.age < 18) { setAgeRestricted(true); return }
    setAgeRestricted(false)
    if (step < 5) return setStep(step + 1)
    onDone({ ...p, target, targetSource: source })
  }
  const back = () => (step > 1 ? setStep(step - 1) : onCancel?.())
  const manualBelowFloor = source === 'manual' && target < calc.floor

  return (
    <Screen>
      <Row style={{ gap: 6, paddingHorizontal: 16, marginTop: 8 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= step ? C.accent : C.border }} />
        ))}
      </Row>
      <Row style={{ paddingHorizontal: 8, paddingVertical: 4 }}>
        <IconButton name="ph ph-caret-left" label="ย้อนกลับ" onPress={back} />
        <Text style={[T.label, T.muted]}>ขั้นที่ {step} จาก 5</Text>
      </Row>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        {step === 1 && (
          <>
            <Text style={T.h1}>ขอข้อมูลพื้นฐานหน่อย</Text>
            <Text style={[T.body, T.muted, { marginTop: 4 }]}>ใช้ในสูตรคำนวณพลังงานที่ร่างกายใช้ต่อวัน เก็บไว้ในบัญชีของคุณเท่านั้น</Text>
            <Row style={{ gap: 10, marginTop: 20, marginBottom: 24 }}>
              {([['female', 'หญิง', 'ph ph-gender-female'], ['male', 'ชาย', 'ph ph-gender-male']] as const).map(([id, label, icon]) => (
                <Pressable
                  key={id}
                  onPress={() => set({ sex: id })}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  accessibilityState={{ selected: p.sex === id }}
                  style={{ flex: 1, minHeight: 76, alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: R.card, borderWidth: p.sex === id ? 1.5 : 1, borderColor: p.sex === id ? C.accent : C.border, backgroundColor: p.sex === id ? C.accentTintSoft : C.surface }}
                >
                  <Icon name={icon} size={24} color={C.accentPressed} />
                  <Text style={{ fontSize: 15, color: C.text }}>{label}</Text>
                </Pressable>
              ))}
            </Row>

            <Row style={{ justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={T.h2}>วันเกิด</Text>
              <Text style={[T.label, T.muted, T.tnum]}>อายุ {calc.age} ปี</Text>
            </Row>
            <Row style={{ gap: 8, marginBottom: 12, alignItems: 'flex-start' }}>
              <PickerField flex={1} label="วัน" value={p.bDay} options={DAYS.map((d) => ({ value: d, label: String(d) }))} onChange={(v) => set({ bDay: v })} />
              <PickerField flex={1.3} label="เดือน" value={p.bMonth} options={MONTHS.map((m, i) => ({ value: i + 1, label: m }))} onChange={(v) => set({ bMonth: v })} />
              <PickerField flex={1.4} label="ปีเกิด" value={p.bYear} options={YEARS.map((y) => ({ value: y, label: `${y} (${y + 543})` }))} onChange={(v) => set({ bYear: v })} />
            </Row>
            {ageRestricted && (
              <View accessibilityRole="alert" style={{ marginTop: 14, padding: 12, borderRadius: 12, backgroundColor: '#f6efe3' }}>
                <Text style={{ color: C.warnText, fontSize: 13.5, lineHeight: 21 }}>
                  KinDee เปิดให้ใช้สำหรับผู้มีอายุ 18 ปีขึ้นไปเท่านั้น หากผู้ปกครองต้องการให้ลบข้อมูล ติดต่อ {legalConfig.privacyEmail}
                </Text>
              </View>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <Text style={T.h1}>ร่างกายตอนนี้</Text>
            <Text style={[T.body, T.muted, { marginTop: 4 }]}>เลื่อนหรือพิมพ์ก็ได้ ปรับทีหลังได้ตลอด</Text>
            <View style={{ gap: 28, marginTop: 24 }}>
              <SliderField label="ส่วนสูง" unit="ซม." min={130} max={200} step={1} value={p.height} onChange={(v) => set({ height: v })} />
              <SliderField label="น้ำหนักตอนนี้" unit="กก." min={35} max={150} step={0.1} value={p.weight} onChange={(v) => set({ weight: v })} />
            </View>
          </>
        )}

        {step === 3 && (
          <>
            <Text style={T.h1}>ปกติขยับตัวแค่ไหน</Text>
            <Text style={[T.body, T.muted, { marginTop: 4 }]}>เลือกอันที่ใกล้เคียงชีวิตจริงที่สุด</Text>
            <View style={{ gap: 10, marginTop: 20 }}>
              {ACTIVITY.map((a) => <OptionCard key={a.id} on={p.activity === a.id} onPress={() => set({ activity: a.id })} icon={a.icon} title={a.label} desc={a.desc} />)}
            </View>
          </>
        )}

        {step === 4 && (
          <>
            <Text style={T.h1}>อยากให้เราช่วยเรื่องอะไร</Text>
            <Text style={[T.body, T.muted, { marginTop: 4 }]}>ทุกทางเลือกใช้ได้ดีเท่ากัน เปลี่ยนทีหลังได้</Text>
            <View style={{ gap: 10, marginTop: 20 }}>
              {GOALS.map((g) => <OptionCard key={g.id} on={p.goal === g.id} onPress={() => set({ goal: g.id })} icon={g.icon} title={g.label} desc={g.desc} />)}
            </View>
          </>
        )}

        {step === 5 && (
          <>
            <Text style={T.h1}>เป้าหมายของคุณ</Text>
            <Card style={{ padding: 20, alignItems: 'center', marginTop: 16, marginBottom: 20 }}>
              <Text style={T.display}>{num(target)}</Text>
              <Text style={[T.label, T.muted, { marginTop: 4 }]}>kcal ต่อวัน · {source === 'manual' ? 'ตั้งเอง' : 'คำนวณอัตโนมัติ'}</Text>
            </Card>

            <Card style={{ padding: 14, marginBottom: 16 }}>
              <Row style={{ alignItems: 'flex-start', gap: 10 }}>
                <Icon name="ph ph-wallet" size={22} color={C.accentPressed} />
                <View style={{ flex: 1 }}>
                  <Text style={T.h2}>{TDEE_EXPLAINER.title}</Text>
                  <Text style={[T.body, T.muted, { marginTop: 4 }]}>{TDEE_EXPLAINER.intro}</Text>
                </View>
              </Row>
              <TextButton onPress={() => setExplainerOpen((v) => !v)} style={{ alignSelf: 'flex-start' }}>
                {explainerOpen ? 'ซ่อนวิธีคิด' : 'ดูวิธีคิดแบบบัญชีและตัวอย่าง'}
              </TextButton>
              {explainerOpen && (
                <View style={{ gap: 8 }}>
                  {TDEE_EXPLAINER.budget.map((item) => (
                    <Text key={item.label} style={T.body}>• <Text style={{ fontWeight: '500' }}>{item.label}</Text> = {item.detail}</Text>
                  ))}
                  <Text style={[T.body, { fontWeight: '500' }]}>{TDEE_EXPLAINER.exampleTitle}</Text>
                  {TDEE_EXPLAINER.examples.map((e) => <Text key={e} style={T.body}>• {e}</Text>)}
                  <Text style={T.body}>{TDEE_EXPLAINER.variableNote}</Text>
                  <Text style={T.body}>{TDEE_EXPLAINER.allocation}</Text>
                </View>
              )}
            </Card>

            <Text style={[T.h2, { marginBottom: 8 }]}>ตัวเลขนี้มาจากไหน</Text>
            <Card style={{ paddingHorizontal: 14, paddingVertical: 4 }}>
              {[
                ['พลังงานพื้นฐาน (BMR)', num(calc.bmr), `Mifflin–St Jeor · ${p.weight} กก. · ${p.height} ซม. · ${calc.age} ปี`],
                ['คูณระดับกิจกรรม', num(calc.tdee), ACTIVITY.find((a) => a.id === p.activity)!.label],
                ['ปรับตามเป้าหมาย', num(calc.raw), GOALS.find((g) => g.id === p.goal)!.label],
              ].map(([label, value, note]) => (
                <View key={label} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border }}>
                  <Row style={{ justifyContent: 'space-between', gap: 12 }}>
                    <Text style={T.body}>{label}</Text>
                    <Text style={[T.body, T.tnum, { fontWeight: '500' }]}>{value}</Text>
                  </Row>
                  <Text style={[T.caption, T.muted]}>{note}</Text>
                </View>
              ))}
              <Row style={{ justifyContent: 'space-between', paddingVertical: 12 }}>
                <Text style={[T.body, { fontWeight: '500' }]}>เป้าที่ใช้</Text>
                <Text style={[T.body, T.tnum, { fontWeight: '500' }]}>{num(target)} kcal</Text>
              </Row>
            </Card>

            {(calc.floored || manualBelowFloor) && (
              <Row accessibilityRole="alert" style={{ alignItems: 'flex-start', gap: 10, backgroundColor: C.accentTintSoft, borderWidth: 1, borderColor: C.accentLine, borderRadius: R.card, padding: 14, marginTop: 14 }}>
                <Icon name="ph ph-heart" size={20} color={C.accentPressed} />
                <Text style={[T.body, { flex: 1, color: C.bodyAlt }]}>
                  {manualBelowFloor
                    ? `เป้าที่ตั้งไว้ต่ำกว่า ${num(calc.floor)} kcal ซึ่งต่ำกว่านี้ร่างกายมักได้สารอาหารไม่ครบ ถ้ามีนักโภชนาการดูแลอยู่ ใช้ค่านี้ต่อได้เลย`
                    : `ปรับขึ้นมาที่ ${num(calc.floor)} kcal ให้แล้ว เพราะต่ำกว่านี้ร่างกายมักได้สารอาหารไม่ครบ ถ้าต้องการลดน้ำหนักมาก ควรปรึกษาผู้เชี่ยวชาญ`}
                </Text>
              </Row>
            )}

            {manualOpen ? (
              <View style={{ marginTop: 14 }}>
                <Field label="เป้าที่อยากตั้งเอง (kcal ต่อวัน)" keyboardType="number-pad" placeholder={String(calc.target)} value={manual} onChangeText={setManual} />
              </View>
            ) : (
              <TextButton style={{ marginTop: 8 }} onPress={() => { setManualOpen(true); setManual(String(calc.target)) }}>
                ปรับเอง — มีเป้าจากนักโภชนาการอยู่แล้ว
              </TextButton>
            )}
          </>
        )}
      </ScrollView>

      <View style={{ backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border, paddingHorizontal: 16, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 12) }}>
        <Button onPress={next}>{step < 5 ? 'ถัดไป' : editMode ? 'บันทึกเป้าหมาย' : 'เริ่มใช้งาน'}</Button>
        <Text style={[T.caption, T.muted, { textAlign: 'center', marginTop: 8 }]}>ทุกค่าจำเป็นต่อการคำนวณ เลยยังข้ามไม่ได้ ขอโทษด้วยนะ</Text>
      </View>
    </Screen>
  )
}
