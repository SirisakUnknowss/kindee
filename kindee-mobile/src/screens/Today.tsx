import { Pressable, ScrollView, Text, View } from 'react-native'
import { BrandLogo, Button, CalorieRing, Card, Chip, Icon, IconButton, MacroBar, OfflineBar, Row, Screen, TextButton } from '../components/ui'
import { foodById } from '../data/foods'
import { MEALS, amountLabel, num, ringTone, totalMacros } from '../lib/calc'
import { ACCOUNTS_ENABLED } from '../config/features'
import { dayKey, useStore } from '../lib/store'
import type { Entry, Meal } from '../lib/types'
import { C, R, T } from '../theme'

const THAI_DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']
const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

function EntryRow({ entry, readOnly, onEdit, onDelete }: { entry: Entry; readOnly: boolean; onEdit: () => void; onDelete: () => void }) {
  const { session } = useStore()
  const manual = entry.entrySource === 'manual'
  const food = manual ? null : foodById(entry.foodId)
  const name = manual ? entry.foodName || 'รายการที่จดเอง' : food!.name
  const unitLabel = manual
    ? `${entry.amount} ${entry.unitLabel || 'หน่วย'} · จดเอง`
    : `${amountLabel(entry.amount)} ${food!.units[entry.unitIx]?.label ?? ''}`

  return (
    <Card style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 14, paddingRight: readOnly ? 14 : 4, paddingVertical: 4 }}>
      <Pressable
        onPress={onEdit}
        disabled={readOnly || manual}
        accessibilityRole="button"
        accessibilityLabel={`${name} ${unitLabel}`}
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}
      >
        <View style={{ flex: 1 }}>
          <Text numberOfLines={2} style={{ fontSize: 15, lineHeight: 22, color: C.text }}>{name}</Text>
          {food?.brand ? <Text style={[T.caption, T.muted]}>{food.brand}</Text> : null}
          <Text style={[T.label, T.muted]}>
            {unitLabel}
            {session?.kind === 'account' && entry.pending ? <Text style={{ color: C.accentPressed }}>  · รอซิงก์</Text> : null}
          </Text>
          {manual && entry.note ? <Text numberOfLines={2} style={[T.caption, T.muted]}>{entry.note}</Text> : null}
        </View>
        <Text style={[{ fontSize: 15, fontWeight: '500', color: C.ledgerDebit }, T.tnum]}>−{num(entry.kcal)}</Text>
      </Pressable>
      {!readOnly && <IconButton name="ph ph-trash" size={19} color={C.muted} label={`ลบ ${name}`} onPress={onDelete} />}
    </Card>
  )
}

export function Today({ dayOffset, onDayChange, onAdd, onScan, onEditEntry, loading }: {
  dayOffset: number
  onDayChange: (d: number) => void
  onAdd: (meal?: Meal) => void
  onScan: () => void
  onEditEntry: (uid: string) => void
  loading?: boolean
}) {
  const { profile, entriesFor, entries: allEntries, session, setSession, removeEntry, online, showMacros, pendingCount, syncFailedCount, retrySync, showToast } = useStore()
  const target = profile?.target ?? 1850

  const d = new Date()
  d.setDate(d.getDate() + dayOffset)
  const entries = entriesFor(dayKey(dayOffset))
  const consumed = entries.reduce((s, e) => s + e.kcal, 0)
  const tone = ringTone(consumed, target)
  const over = consumed > target
  const readOnly = dayOffset < 0
  const macros = totalMacros(entries)
  const dateLabel = dayOffset === 0 ? 'วันนี้' : `${d.getDate()} ${THAI_MONTHS[d.getMonth()]}`

  return (
    <Screen>
      {!online && <OfflineBar text="ยังไม่ได้ซิงก์ · บันทึกไว้ในเครื่องแล้ว" />}
      {online && pendingCount > 0 && syncFailedCount === 0 && <OfflineBar icon="ph ph-cloud-arrow-up" text={`กำลังซิงก์ ${pendingCount} รายการ`} />}
      {online && syncFailedCount > 0 && (
        <OfflineBar icon="ph ph-cloud-x" text="ซิงก์ยังไม่สำเร็จ ข้อมูลยังอยู่ในเครื่อง" right={<TextButton onPress={retrySync}>ลองอีกครั้ง</TextButton>} />
      )}
      {readOnly && <OfflineBar icon="ph ph-clock-counter-clockwise" text="กำลังดูย้อนหลัง — โหมดอ่านอย่างเดียว" />}

      <Row style={{ paddingHorizontal: 8, paddingVertical: 4, gap: 4 }}>
        <IconButton name="ph ph-caret-left" size={20} label="วันก่อนหน้า" onPress={() => onDayChange(dayOffset - 1)} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ fontSize: 16, fontWeight: '500', color: C.text }}>{dateLabel}</Text>
          <Text style={[T.caption, T.muted]}>{THAI_DAYS[d.getDay()]}</Text>
        </View>
        <IconButton name="ph ph-caret-right" size={20} label="วันถัดไป" disabled={dayOffset >= 0} onPress={() => onDayChange(Math.min(0, dayOffset + 1))} />
        <Chip icon="ph ph-barcode" onPress={onScan}>สแกน</Chip>
      </Row>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 152 }}>
        {ACCOUNTS_ENABLED && session?.kind === 'guest' && allEntries.length >= 3 && (
          <Card style={{ flexDirection: 'row', alignItems: 'center', padding: 12, marginTop: 8, gap: 10 }}>
            <Icon name="ph ph-cloud-arrow-up" size={22} color={C.accentPressed} />
            <View style={{ flex: 1 }}>
              <Text style={[T.body, { fontWeight: '500' }]}>สำรองรายการที่บันทึกไว้</Text>
              <Text style={[T.caption, T.muted]}>สร้างบัญชีฟรีเพื่อใช้ต่อบนเครื่องอื่น ข้อมูลในเครื่องจะไม่ถูกลบ</Text>
            </View>
            <TextButton onPress={() => setSession(null)}>สำรองฟรี</TextButton>
          </Card>
        )}

        <View style={{ paddingTop: 8, paddingBottom: 4 }}>
          <CalorieRing consumed={consumed} target={target} tone={tone} loading={loading} />
          {!loading && (
            <Card style={{ marginTop: 12, paddingHorizontal: 14, paddingVertical: 5 }}>
              {[
                ['ph ph-wallet', 'งบวันนี้', `+${num(target)}`, C.ledgerCredit],
                ['ph ph-receipt', 'ใช้ไป', `−${num(consumed)}`, C.ledgerDebit],
              ].map(([icon, label, value, color]) => (
                <Row key={label} style={{ minHeight: 38, justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: C.ledgerRule, borderStyle: 'dotted' }}>
                  <Row style={{ gap: 7 }}><Icon name={icon} size={16} color={C.bodyAlt} /><Text style={{ color: C.bodyAlt, fontSize: 13.5 }}>{label}</Text></Row>
                  <Text style={[{ fontWeight: '500', color }, T.tnum]}>{value}</Text>
                </Row>
              ))}
              <Row style={{ minHeight: 38, justifyContent: 'space-between' }}>
                <Text style={{ color: C.bodyAlt, fontSize: 13.5, fontWeight: '500' }}>{over ? 'ใช้เกินงบ' : 'คงเหลือ'}</Text>
                <Text style={[{ fontWeight: '500', color: C.text }, T.tnum]}>{over ? '−' : ''}{num(Math.abs(target - consumed))} kcal</Text>
              </Row>
            </Card>
          )}
        </View>

        {showMacros && !loading && entries.length > 0 && <MacroBar macros={macros} />}

        {loading ? (
          <View style={{ gap: 10, marginTop: 24 }}>
            {[0, 1, 2].map((i) => <View key={i} style={{ height: 66, borderRadius: 16, backgroundColor: C.border }} />)}
          </View>
        ) : entries.length === 0 && !readOnly ? (
          <View style={{ alignItems: 'center', marginTop: 24, gap: 12 }}>
            <BrandLogo size={112} />
            <Text style={T.h2}>เริ่มจากมื้อแรกกันเลย</Text>
            <Text style={[T.body, T.muted, { maxWidth: 280, textAlign: 'center' }]}>สแกนบาร์โค้ดของในร้านได้เลย หรือค้นหาชื่ออาหารก็ได้ ใช้เวลาไม่กี่วินาที</Text>
            <View style={{ gap: 10, alignSelf: 'stretch', marginTop: 4 }}>
              <Button onPress={onScan} icon={<Icon name="ph ph-barcode" size={20} color="#fff" />}>สแกนบาร์โค้ด</Button>
              <Button variant="outline" onPress={() => onAdd()}>ค้นหาชื่ออาหาร</Button>
            </View>
          </View>
        ) : (
          <View style={{ gap: 18, marginTop: 20 }}>
            {MEALS.map((m) => {
              const list = entries.filter((e) => e.meal === m.id)
              if (readOnly && list.length === 0) return null
              const sum = list.reduce((s, e) => s + e.kcal, 0)
              return (
                <View key={m.id}>
                  <Row style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                    <Row style={{ gap: 8 }}>
                      <Text style={[T.h2, { opacity: list.length ? 1 : 0.6 }]}>{m.label}</Text>
                      {list.length > 0 && <Text style={[T.label, T.muted, T.tnum]}>ใช้ไป −{num(sum)} kcal</Text>}
                    </Row>
                    {!readOnly && <IconButton name="ph ph-plus" size={20} color={C.accentPressed} label={`เพิ่มอาหารมื้อ${m.label}`} onPress={() => onAdd(m.id)} />}
                  </Row>
                  {list.length === 0 ? (
                    <Pressable
                      onPress={() => onAdd(m.id)}
                      style={{ minHeight: 56, borderWidth: 1, borderStyle: 'dashed', borderColor: C.borderStrong, borderRadius: R.card, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Text style={{ color: C.muted, fontSize: 13 }}>ยังไม่มีอะไรในมื้อนี้ · แตะเพื่อเพิ่ม</Text>
                    </Pressable>
                  ) : (
                    <View style={{ gap: 8 }}>
                      {list.map((e) => (
                        <EntryRow
                          key={e.uid}
                          entry={e}
                          readOnly={readOnly}
                          onEdit={() => onEditEntry(e.uid)}
                          onDelete={() => { removeEntry(e.uid); showToast('ลบรายการแล้ว') }}
                        />
                      ))}
                    </View>
                  )}
                </View>
              )
            })}
          </View>
        )}
      </ScrollView>
    </Screen>
  )
}
