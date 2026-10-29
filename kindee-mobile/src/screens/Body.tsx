import { useMemo, useState } from 'react'
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg'
import { Button, Card, Checkbox, Chip, Header, Icon, IconButton, Row, Screen, Sheet, TextButton } from '../components/ui'
import {
  MEASURES, PERIODS, aggregate, applyToProfile, latestValues, measureMeta, parseMeasurementInput, shortDay, signed, toUnit, unitLabel,
  type BodyMeasurement, type BodyValues, type LengthUnit, type MeasureKey, type Period,
} from '../lib/body'
import { ageFrom, num } from '../lib/calc'
import { dayKey, useStore } from '../lib/store'
import type { Profile } from '../lib/types'
import { C, R, T } from '../theme'

type Draft = { day: string; fields: Partial<Record<MeasureKey, string>>; prefilled: BodyValues; editing: boolean }

const shiftDay = (day: string, delta: number) => {
  const [y, m, d] = day.split('-').map(Number)
  const date = new Date(y, m - 1, d + delta, 12)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** กราฟเส้นเล็ก ๆ ของค่าเดียว — ช่วงละหนึ่งจุด */
function TrendChart({ points, unit }: { points: { label: string; value: number }[]; unit: string }) {
  const [width, setWidth] = useState(0)
  if (points.length < 2) {
    return <Text style={[T.caption, T.muted, { textAlign: 'center', paddingVertical: 18 }]}>บันทึกอย่างน้อย 2 ช่วงเพื่อดูกราฟแนวโน้ม</Text>
  }
  const h = 150
  const pad = { l: 8, r: 8, t: 22, b: 24 }
  const values = points.map((p) => p.value)
  const min = Math.min(...values)
  const span = Math.max(...values) - min || 1
  const x = (i: number) => pad.l + (i * (width - pad.l - pad.r)) / (points.length - 1)
  const y = (v: number) => pad.t + (1 - (v - min) / span) * (h - pad.t - pad.b)
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const labelEvery = Math.ceil(points.length / 5)
  const anchor = (i: number) => (i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle')
  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} accessible accessibilityLabel={`กราฟแนวโน้ม ${points.map((p) => `${p.label} ${p.value} ${unit}`).join(', ')}`}>
      {width > 0 && (
        <Svg width={width} height={h}>
          <Line x1={pad.l} x2={width - pad.r} y1={h - pad.b} y2={h - pad.b} stroke={C.border} />
          <Path d={path} fill="none" stroke={C.accent} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          {points.map((p, i) => (
            <Circle key={`c${p.label}`} cx={x(i)} cy={y(p.value)} r={4} fill={C.surface} stroke={C.accent} strokeWidth={2} />
          ))}
          {points.map((p, i) => (i === points.length - 1 || i % labelEvery === 0) ? (
            <SvgText key={`v${p.label}`} x={x(i)} y={y(p.value) - 9} textAnchor={anchor(i)} fontSize={11} fontWeight="600" fill={C.text}>{String(p.value)}</SvgText>
          ) : null)}
          {points.map((p, i) => (i === points.length - 1 || i % labelEvery === 0) ? (
            <SvgText key={`l${p.label}`} x={x(i)} y={h - 7} textAnchor={anchor(i)} fontSize={10} fill={C.muted}>{p.label}</SvgText>
          ) : null)}
        </Svg>
      )}
    </View>
  )
}

const Change = ({ value }: { value?: number }) =>
  value == null
    ? <Text style={[T.caption, T.muted]}>—</Text>
    : <Text style={[{ fontSize: 12.5, color: C.accentPressed, fontWeight: '500' }, T.tnum]}>{signed(value)}</Text>

export function Body({ onBack, onProfileUpdate }: { onBack: () => void; onProfileUpdate: (p: Profile) => void }) {
  const { profile, measurements, saveMeasurement, removeMeasurement, showToast, lengthUnit, setLengthUnit } = useStore()
  const unit = (key: MeasureKey) => unitLabel(key, lengthUnit)
  const show = (key: MeasureKey, v: number) => toUnit(key, v, lengthUnit)
  const [period, setPeriod] = useState<Period>('week')
  const [metric, setMetric] = useState<MeasureKey>('weight')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [applyProfile, setApplyProfile] = useState(true)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const rows = useMemo(() => aggregate(measurements, period), [measurements, period])
  const latest = useMemo(() => latestValues(measurements), [measurements])
  const lastDay = measurements.length ? measurements[measurements.length - 1].day : ''
  const meta = measureMeta(metric)
  const metricRows = rows.filter((r) => r.values[metric] != null)
  const chartPoints = metricRows.slice(-12).map((r) => ({ label: r.label, value: show(metric, r.values[metric]!) }))
  const current = rows[rows.length - 1]
  const periodMeta = PERIODS.find((p) => p.id === period)!
  const age = profile ? ageFrom(profile.bDay, profile.bMonth, profile.bYear) : null
  const today = dayKey()

  const openForm = (m?: BodyMeasurement) => {
    const source = m ?? { ...latest, weight: latest.weight ?? profile?.weight, height: latest.height ?? profile?.height }
    const fields: Draft['fields'] = {}
    const prefilled: BodyValues = {}
    for (const { key } of MEASURES) {
      if (source[key] == null) continue
      prefilled[key] = source[key]
      fields[key] = String(show(key, source[key]!))
    }
    setDraft({ day: m?.day ?? today, fields, prefilled, editing: Boolean(m) })
    setApplyProfile(true)
    setError('')
  }

  const isNewest = draft ? !lastDay || draft.day >= lastDay : false

  const save = () => {
    if (!draft) return
    const parsed = parseMeasurementInput(draft.fields, lengthUnit, draft.prefilled)
    if (!parsed.ok) return setError(parsed.error)
    saveMeasurement(draft.day, parsed.values)
    const next = profile && isNewest && applyProfile ? applyToProfile(profile, parsed.values) : null
    if (next) {
      onProfileUpdate(next)
      showToast(next.target !== profile!.target
        ? `บันทึกแล้ว เป้าใหม่ ${num(next.target)} kcal`
        : profile!.targetSource === 'manual' ? 'บันทึกแล้ว อัปเดตน้ำหนักในโปรไฟล์ (เป้าที่ตั้งเองไม่เปลี่ยน)' : 'บันทึกค่าวัดแล้ว')
    } else {
      showToast('บันทึกค่าวัดแล้ว')
    }
    setDraft(null)
  }

  return (
    <Screen>
      <Header title="ติดตามรูปร่าง" onBack={onBack} right={<IconButton name="ph ph-plus" label="บันทึกค่าวัด" onPress={() => openForm()} />} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: 12 }}>
        <Card style={{ padding: 14, flexDirection: 'row' }}>
          {[
            ['อายุ', age != null ? `${age} ปี` : '—'],
            ['ส่วนสูง', (latest.height ?? profile?.height) != null ? `${show('height', (latest.height ?? profile?.height)!)} ${unit('height')}` : '—'],
            ['น้ำหนัก', `${latest.weight ?? profile?.weight ?? '—'} กก.`],
          ].map(([label, value]) => (
            <View key={label} style={{ flex: 1, gap: 2 }}>
              <Text style={[T.caption, T.muted]}>{label}</Text>
              <Text style={[{ fontSize: 17, fontWeight: '600', color: C.text }, T.tnum]}>{value}</Text>
            </View>
          ))}
        </Card>
        <Row style={{ marginTop: -6, gap: 10, justifyContent: 'space-between' }}>
          <Text style={[T.caption, T.muted, { flex: 1 }]}>อายุคำนวณจากวันเกิดในโปรไฟล์ · แก้ได้ที่ Profile → เป้าหมาย</Text>
          <Row style={{ padding: 3, borderWidth: 1, borderColor: C.border, borderRadius: 10, backgroundColor: C.surface }} accessibilityRole="radiogroup" accessibilityLabel="หน่วยความยาว">
            {([['cm', 'ซม.'], ['in', 'นิ้ว']] as [LengthUnit, string][]).map(([id, label]) => (
              <Pressable key={id} onPress={() => setLengthUnit(id)} accessibilityRole="radio" accessibilityState={{ checked: lengthUnit === id }}
                style={{ minHeight: 32, minWidth: 48, paddingHorizontal: 10, borderRadius: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: lengthUnit === id ? C.accent : 'transparent' }}>
                <Text style={{ fontSize: 12.5, color: lengthUnit === id ? C.onAccent : C.muted, fontWeight: lengthUnit === id ? '600' : '400' }}>{label}</Text>
              </Pressable>
            ))}
          </Row>
        </Row>

        <Button icon={<Icon name="ph ph-ruler" size={20} color={C.onAccent} />} onPress={() => openForm()}>บันทึกค่าวัดวันนี้</Button>

        {measurements.length === 0 ? (
          <Card style={{ padding: 24, alignItems: 'center', gap: 6 }}>
            <Icon name="ph ph-person-simple" size={34} color={C.accentPressed} />
            <Text style={T.body}>ยังไม่มีค่าวัด</Text>
            <Text style={[T.caption, T.muted, { textAlign: 'center' }]}>วัดตอนเช้าก่อนกินอาหาร ใช้สายวัดเส้นเดิมและวัดตำแหน่งเดิมทุกครั้ง จะเห็นแนวโน้มชัดกว่า</Text>
          </Card>
        ) : (
          <>
            <Row style={{ padding: 4, borderWidth: 1, borderColor: C.border, borderRadius: 14, backgroundColor: C.surface }} accessibilityRole="tablist">
              {PERIODS.map((p) => (
                <Pressable key={p.id} onPress={() => setPeriod(p.id)} accessibilityRole="tab" accessibilityState={{ selected: period === p.id }}
                  style={{ flex: 1, minHeight: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: period === p.id ? C.accent : 'transparent' }}>
                  <Text style={{ fontSize: 13, color: period === p.id ? C.onAccent : C.muted, fontWeight: period === p.id ? '600' : '400' }}>{p.label}</Text>
                </Pressable>
              ))}
            </Row>

            {current && (
              <Card style={{ padding: 14 }}>
                <Text style={T.h2}>{current.label}</Text>
                <Text style={[T.caption, T.muted]}>{period === 'day' ? 'ค่าที่วัด' : `ค่าเฉลี่ยจาก ${current.count} วัน`} · เทียบ{periodMeta.previous}ที่มีการวัด</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                  {MEASURES.filter((m) => current.values[m.key] != null).map((m) => (
                    <Pressable key={m.key} onPress={() => setMetric(m.key)} accessibilityRole="button" accessibilityState={{ selected: metric === m.key }}
                      style={{ width: '48.5%', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: metric === m.key ? C.accentLine : C.border, backgroundColor: metric === m.key ? C.accentTint : C.accentTintSoft, gap: 2 }}>
                      <Text style={[T.caption, T.muted]}>{m.label}</Text>
                      <Text style={[{ fontSize: 18, fontWeight: '600', color: C.text }, T.tnum]}>{show(m.key, current.values[m.key]!)} <Text style={[T.caption, T.muted]}>{unit(m.key)}</Text></Text>
                      <Change value={current.change[m.key] == null ? undefined : show(m.key, current.change[m.key]!)} />
                    </Pressable>
                  ))}
                </View>
              </Card>
            )}

            <Card style={{ padding: 14, gap: 12 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {MEASURES.map((m) => <Chip key={m.key} on={metric === m.key} onPress={() => setMetric(m.key)} style={{ minHeight: 36 }}>{m.label}</Chip>)}
              </ScrollView>
              <TrendChart points={chartPoints} unit={unit(metric)} />
              {metricRows.length > 0 ? (
                <View>
                  <Row style={{ borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 6 }}>
                    <Text style={[T.caption, T.muted, { flex: 1.4 }]}>{periodMeta.label.replace('ราย', '')}</Text>
                    <Text style={[T.caption, T.muted, { flex: 1, textAlign: 'right' }]}>{meta.label} ({unit(metric)})</Text>
                    <Text style={[T.caption, T.muted, { flex: 1, textAlign: 'right' }]}>เปลี่ยนแปลง</Text>
                  </Row>
                  {[...metricRows].reverse().map((r, i) => (
                    <Row key={r.start} style={{ paddingVertical: 9, borderTopWidth: i ? 1 : 0, borderTopColor: C.border }}>
                      <Text style={[T.body, { flex: 1.4 }]}>{r.label}</Text>
                      <Text style={[T.body, T.tnum, { flex: 1, textAlign: 'right' }]}>{show(metric, r.values[metric]!)}</Text>
                      <View style={{ flex: 1, alignItems: 'flex-end' }}><Change value={r.change[metric] == null ? undefined : show(metric, r.change[metric]!)} /></View>
                    </Row>
                  ))}
                </View>
              ) : (
                <Text style={[T.caption, T.muted]}>ยังไม่ได้วัด{meta.label}</Text>
              )}
            </Card>

            <Card style={{ padding: 14 }}>
              <Text style={[T.h2, { marginBottom: 4 }]}>ประวัติการวัด</Text>
              {[...measurements].reverse().map((m) => (
                <Row key={m.day} style={{ gap: 4, paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.border }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[T.body, { fontWeight: '500' }]}>{shortDay(m.day)}{m.pending ? <Text style={[T.caption, T.muted]}> · รอซิงก์</Text> : null}</Text>
                    <Text style={[T.caption, T.muted, T.tnum]}>{MEASURES.filter((x) => m[x.key] != null).map((x) => `${x.label} ${show(x.key, m[x.key]!)} ${unit(x.key)}`).join(' · ')}</Text>
                  </View>
                  {confirmDelete === m.day ? (
                    <>
                      <TextButton onPress={() => setConfirmDelete(null)}>ยกเลิก</TextButton>
                      <Pressable onPress={() => { removeMeasurement(m.day); setConfirmDelete(null); showToast('ลบค่าวัดแล้ว') }} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 6 }}>
                        <Text style={{ color: C.warnText, fontSize: 13.5 }}>ยืนยันลบ</Text>
                      </Pressable>
                    </>
                  ) : (
                    <>
                      <IconButton name="ph ph-pencil-simple" size={19} label={`แก้ไขค่าวัด ${shortDay(m.day)}`} onPress={() => openForm(m)} />
                      <IconButton name="ph ph-trash" size={19} label={`ลบค่าวัด ${shortDay(m.day)}`} onPress={() => setConfirmDelete(m.day)} />
                    </>
                  )}
                </Row>
              ))}
            </Card>
          </>
        )}
      </ScrollView>

      {draft && (
        <Sheet onClose={() => setDraft(null)}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 12, paddingBottom: 8 }}>
            <Text style={T.h2}>{draft.editing ? 'แก้ไขค่าวัด' : 'บันทึกค่าวัด'}</Text>
            <View>
              <Text style={[T.caption, T.muted, { marginBottom: 6 }]}>วันที่วัด</Text>
              <Row style={{ borderWidth: 1, borderColor: C.borderStrong, borderRadius: R.btn, minHeight: 52, paddingHorizontal: 4 }}>
                <IconButton name="ph ph-caret-left" label="วันก่อนหน้า" disabled={draft.editing} onPress={() => setDraft({ ...draft, day: shiftDay(draft.day, -1) })} />
                <Text style={[T.body, { flex: 1, textAlign: 'center', fontWeight: '500' }]}>{draft.day === today ? `วันนี้ · ${shortDay(draft.day)}` : shortDay(draft.day)}</Text>
                <IconButton name="ph ph-caret-right" label="วันถัดไป" disabled={draft.editing || draft.day >= today} onPress={() => setDraft({ ...draft, day: shiftDay(draft.day, 1) })} />
              </Row>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 }}>
              {MEASURES.map((m) => (
                <View key={m.key} style={{ width: '48.5%' }}>
                  <Text style={[T.caption, T.muted, { marginBottom: 6 }]}>{m.label}</Text>
                  <View style={{ justifyContent: 'center' }}>
                    <TextInput
                      value={draft.fields[m.key] ?? ''}
                      onChangeText={(text) => { setDraft({ ...draft, fields: { ...draft.fields, [m.key]: text } }); setError('') }}
                      keyboardType="decimal-pad"
                      placeholder="–"
                      placeholderTextColor="#9aa29c"
                      accessibilityLabel={`${m.label} (${unit(m.key)})`}
                      style={[{ minHeight: 52, borderWidth: 1, borderColor: C.borderStrong, borderRadius: R.btn, paddingLeft: 14, paddingRight: 46, fontSize: 15, color: C.text, backgroundColor: C.surface }, T.tnum]}
                    />
                    <Text style={[T.caption, T.muted, { position: 'absolute', right: 13 }]} pointerEvents="none">{unit(m.key)}</Text>
                  </View>
                </View>
              ))}
            </View>
            <Text style={[T.caption, T.muted]}>เว้นว่างช่องที่ไม่ได้วัดได้ บันทึกวันเดิมซ้ำจะแทนที่ค่าเดิม</Text>
            {profile && isNewest && (
              <View style={{ padding: 12, borderRadius: 12, backgroundColor: C.accentTintSoft }}>
                <Checkbox checked={applyProfile} onChange={setApplyProfile}>
                  <Text style={T.body}>ใช้น้ำหนัก/ส่วนสูงนี้ในโปรไฟล์</Text>
                  <Text style={[T.caption, T.muted]}>{profile.targetSource === 'auto' ? 'เป้าแคลอรีจะคำนวณใหม่ตาม TDEE' : 'เป้าที่คุณตั้งเองจะไม่เปลี่ยน'}</Text>
                </Checkbox>
              </View>
            )}
            {error ? (
              <Row style={{ gap: 6 }}>
                <Icon name="ph ph-warning-circle" size={14} color={C.warnText} />
                <Text style={{ fontSize: 12.5, color: C.warnText, flex: 1 }} accessibilityRole="alert">{error}</Text>
              </Row>
            ) : null}
            <Button onPress={save}>บันทึก</Button>
          </ScrollView>
        </Sheet>
      )}
    </Screen>
  )
}
