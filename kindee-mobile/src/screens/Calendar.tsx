import { useMemo, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import Svg, { Circle, Path } from 'react-native-svg'
import { Card, Icon, IconButton, Row, Screen } from '../components/ui'
import { num } from '../lib/calc'
import { dayKey, useStore } from '../lib/store'
import { C, T } from '../theme'

type DayStatus = 'success' | 'under' | 'over' | 'empty'
const MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
const statusLabel: Record<DayStatus, string> = { success: 'สำเร็จ', under: 'ยังไม่ถึงเป้า', over: 'เกินเป้า', empty: 'ไม่ได้บันทึก' }
const statusColor: Record<DayStatus, string> = { success: C.statusNear, under: C.statusFar, over: C.statusOver, empty: C.border }

function fromKey(key: string) {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}
function toKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
function statusFor(total: number, target: number): DayStatus {
  if (total <= 0) return 'empty'
  if (total > target) return 'over'
  return total >= target * 0.85 ? 'success' : 'under'
}

function CalendarRing({ total, target }: { total: number; target: number }) {
  const status = statusFor(total, target)
  const circumference = 2 * Math.PI * 16
  const percent = target > 0 ? Math.min(1, total / target) : 0
  return (
    <Svg width={41} height={41} viewBox="0 0 42 42">
      <Circle cx={21} cy={21} r={16} fill="none" stroke={C.border} strokeWidth={5} />
      {total > 0 && (
        <Circle cx={21} cy={21} r={16} fill="none" stroke={statusColor[status]} strokeWidth={5} strokeLinecap="round"
          strokeDasharray={`${circumference * percent} ${circumference}`} transform="rotate(-90 21 21)" />
      )}
      {status === 'success' && <Path d="m15.5 21 3.7 3.8 7.5-8" fill="none" stroke={statusColor.success} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />}
    </Svg>
  )
}

export function Calendar({ onOpenDay }: { onOpenDay: (day: string) => void }) {
  const { entries, profile } = useStore()
  const [month, setMonth] = useState(() => fromKey(dayKey()))
  const today = fromKey(dayKey())
  const target = profile?.target ?? 1850
  const totals = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of entries) map.set(e.day, (map.get(e.day) ?? 0) + e.kcal)
    return map
  }, [entries])
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const offset = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7
  const dates = Array.from({ length: count }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))
  const logged = dates.filter((d) => d <= today && (totals.get(toKey(d)) ?? 0) > 0)
  const successes = logged.filter((d) => statusFor(totals.get(toKey(d)) ?? 0, target) === 'success').length
  const average = logged.length ? Math.round(logged.reduce((s, d) => s + (totals.get(toKey(d)) ?? 0), 0) / logged.length) : 0
  const currentMonth = month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth()
  const moveMonth = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1))

  const cells: (Date | null)[] = [...Array.from({ length: offset }, () => null), ...dates]
  while (cells.length % 7) cells.push(null)

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 }}>
        <View>
          <Text style={[T.caption, T.muted]}>ประวัติรายวัน</Text>
          <Text style={T.h1}>Calendar</Text>
        </View>
        <Icon name="ph ph-calendar-dots" size={27} color={C.accentPressed} />
      </Row>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 140, gap: 12 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <IconButton name="ph ph-caret-left" label="เดือนก่อนหน้า" onPress={() => moveMonth(-1)} />
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 16, fontWeight: '500', color: C.text }}>{MONTHS[month.getMonth()]} {month.getFullYear() + 543}</Text>
            <Text style={[T.caption, T.muted]}>แตะวันที่เพื่อเปิดข้อมูล Health</Text>
          </View>
          <IconButton name="ph ph-caret-right" label="เดือนถัดไป" disabled={currentMonth} onPress={() => moveMonth(1)} />
        </Row>

        <Card style={{ padding: 10 }}>
          <Row style={{ marginBottom: 6 }}>
            {['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.'].map((d) => (
              <Text key={d} style={[T.caption, T.muted, { flex: 1, textAlign: 'center' }]}>{d}</Text>
            ))}
          </Row>
          {Array.from({ length: cells.length / 7 }, (_, w) => (
            <Row key={w}>
              {cells.slice(w * 7, w * 7 + 7).map((date, i) => {
                if (!date) return <View key={i} style={{ flex: 1 }} />
                const key = toKey(date)
                const total = totals.get(key) ?? 0
                const isToday = key === dayKey()
                return (
                  <Pressable
                    key={i}
                    disabled={date > today}
                    onPress={() => onOpenDay(key)}
                    accessibilityRole="button"
                    accessibilityLabel={`${date.getDate()} ${MONTHS[date.getMonth()]} ${statusLabel[statusFor(total, target)]}`}
                    style={{ flex: 1, alignItems: 'center', paddingVertical: 4, opacity: date > today ? 0.35 : 1 }}
                  >
                    <Text style={[T.caption, { color: isToday ? C.accentPressed : C.text, fontWeight: isToday ? '700' : '400' }]}>{date.getDate()}</Text>
                    <CalendarRing total={total} target={target} />
                  </Pressable>
                )
              })}
            </Row>
          ))}
        </Card>

        <Row style={{ gap: 8 }}>
          {[[successes, 'วันสำเร็จ'], [logged.length, 'วันที่บันทึก'], [num(average), 'เฉลี่ย kcal']].map(([v, l]) => (
            <Card key={l as string} style={{ flex: 1, padding: 12, alignItems: 'center' }}>
              <Text style={[{ fontSize: 20, fontWeight: '500', color: C.text }, T.tnum]}>{v}</Text>
              <Text style={[T.caption, T.muted]}>{l}</Text>
            </Card>
          ))}
        </Row>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, justifyContent: 'center' }}>
          {(['success', 'under', 'over', 'empty'] as DayStatus[]).map((s) => (
            <Row key={s} style={{ gap: 6 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: statusColor[s] }} />
              <Text style={[T.caption, T.muted]}>{statusLabel[s]}</Text>
            </Row>
          ))}
        </View>
      </ScrollView>
    </Screen>
  )
}
