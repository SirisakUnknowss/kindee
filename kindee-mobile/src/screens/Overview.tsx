import { Pressable, ScrollView, Text, View } from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import { Card, Icon, IconButton, Row, Screen } from '../components/ui'
import { MEALS, num, ringColor, ringTone, totalMacros } from '../lib/calc'
import { dayKey, useStore } from '../lib/store'
import { C, T } from '../theme'

const WEEK_DAYS = ['พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.', 'จ.', 'อ.']

export function Overview({ onOpenHealth, onAdd }: { onOpenHealth: () => void; onAdd: () => void }) {
  const { entries, entriesFor, profile } = useStore()
  const target = profile?.target ?? 1850
  const todayEntries = entriesFor(dayKey())
  const consumed = todayEntries.reduce((sum, e) => sum + e.kcal, 0)
  const remaining = Math.max(0, target - consumed)
  const percent = target > 0 ? Math.round((consumed / target) * 100) : 0
  const tone = ringTone(consumed, target)
  const macros = totalMacros(todayEntries)
  const radius = 58
  const circumference = 2 * Math.PI * radius
  const week = Array.from({ length: 7 }, (_, i) => {
    const key = dayKey(i - 6)
    return entries.filter((e) => e.day === key).reduce((sum, e) => sum + e.kcal, 0)
  })
  const weekMax = Math.max(target, ...week)
  const loggedDays = week.filter((t) => t > 0).length

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
        <View>
          <Text style={[T.caption, T.muted]}>วันนี้</Text>
          <Text style={T.h1}>Overview</Text>
        </View>
        <IconButton name="ph ph-heartbeat" size={25} label="เปิดข้อมูลสุขภาพ" onPress={onOpenHealth} />
      </Row>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 140, gap: 12 }}>
        <Card style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <View style={{ width: 120, height: 120 }}>
            <Svg width={120} height={120} viewBox="0 0 140 140">
              <Circle cx={70} cy={70} r={radius} fill="none" stroke={C.border} strokeWidth={13} />
              {consumed > 0 && (
                <Circle cx={70} cy={70} r={radius} fill="none" stroke={ringColor(tone)} strokeWidth={13} strokeLinecap="round"
                  strokeDasharray={`${circumference * Math.min(1, consumed / target)} ${circumference}`} transform="rotate(-90 70 70)" />
              )}
            </Svg>
            <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={[{ fontSize: 22, fontWeight: '500', color: C.text }, T.tnum]}>{percent}%</Text>
              <Text style={[T.caption, T.muted]}>ของเป้า</Text>
            </View>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[T.caption, T.muted]}>พลังงานวันนี้</Text>
            <Text style={[{ fontSize: 28, fontWeight: '500', color: C.text }, T.tnum]}>{num(consumed)} <Text style={{ fontSize: 14, fontWeight: '400' }}>kcal</Text></Text>
            <Text style={[T.body, T.muted]}>{consumed > target ? `เกินเป้า ${num(consumed - target)} kcal` : `เหลืออีก ${num(remaining)} kcal`}</Text>
            <Pressable onPress={onOpenHealth} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
              <Text style={{ color: C.accentPressed, fontSize: 13.5 }}>ดูรายละเอียด</Text>
              <Icon name="ph ph-arrow-right" size={15} color={C.accentPressed} />
            </Pressable>
          </View>
        </Card>

        <Row style={{ gap: 8 }}>
          {[
            ['ph ph-flag', 'เป้าต่อวัน', target],
            ['ph ph-fork-knife', 'กินไป', consumed],
            ['ph ph-wallet', 'คงเหลือ', remaining],
          ].map(([icon, label, value]) => (
            <Card key={label as string} style={{ flex: 1, padding: 12, gap: 2 }}>
              <Icon name={icon as string} size={18} color={C.accentPressed} />
              <Text style={[T.caption, T.muted]}>{label as string}</Text>
              <Text style={[{ fontSize: 17, fontWeight: '500', color: C.text }, T.tnum]}>{num(value as number)}</Text>
            </Card>
          ))}
        </Row>

        <Card style={{ padding: 16 }}>
          <Row style={{ justifyContent: 'space-between', marginBottom: 12 }}>
            <View>
              <Text style={T.h2}>7 วันที่ผ่านมา</Text>
              <Text style={[T.caption, T.muted]}>บันทึกแล้ว {loggedDays} วัน</Text>
            </View>
            <Icon name="ph ph-chart-bar" size={22} color={C.accentPressed} />
          </Row>
          <Row style={{ height: 110, alignItems: 'flex-end', gap: 8 }}>
            {week.map((total, i) => (
              <View key={i} style={{ flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center', gap: 6 }}>
                <View style={{ width: '100%', height: `${Math.max(4, (total / weekMax) * 100) * 0.8}%`, minHeight: 4, borderRadius: 6, backgroundColor: total > target ? C.statusOver : C.accentLine }} />
                <Text style={[T.caption, T.muted]}>{WEEK_DAYS[i]}</Text>
              </View>
            ))}
          </Row>
        </Card>

        <Card style={{ padding: 16 }}>
          <Row style={{ justifyContent: 'space-between', marginBottom: 12 }}>
            <View>
              <Text style={T.h2}>มื้อวันนี้</Text>
              <Text style={[T.caption, T.muted]}>{todayEntries.length} รายการ</Text>
            </View>
            <Pressable onPress={onAdd} accessibilityRole="button"><Text style={{ color: C.accentPressed, fontSize: 13.5 }}>เพิ่มอาหาร</Text></Pressable>
          </Row>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {MEALS.map((meal) => {
              const total = todayEntries.filter((e) => e.meal === meal.id).reduce((sum, e) => sum + e.kcal, 0)
              return (
                <Pressable key={meal.id} onPress={onOpenHealth} accessibilityRole="button" style={{ width: '48.5%', padding: 12, borderRadius: 12, backgroundColor: C.accentTintSoft, gap: 2 }}>
                  <Icon name={meal.icon} size={19} color={C.accentPressed} />
                  <Text style={[T.label, T.muted]}>{meal.label}</Text>
                  <Text style={[{ fontSize: 16, fontWeight: '500', color: C.text }, T.tnum]}>{num(total)}</Text>
                </Pressable>
              )
            })}
          </View>
        </Card>

        {todayEntries.length > 0 && (
          <Row style={{ justifyContent: 'space-around' }}>
            <Text style={[T.label, T.muted]}>โปรตีน <Text style={{ fontWeight: '500', color: C.text }}>{num(macros.protein)} ก.</Text></Text>
            <Text style={[T.label, T.muted]}>คาร์บ <Text style={{ fontWeight: '500', color: C.text }}>{num(macros.carb)} ก.</Text></Text>
            <Text style={[T.label, T.muted]}>ไขมัน <Text style={{ fontWeight: '500', color: C.text }}>{num(macros.fat)} ก.</Text></Text>
          </Row>
        )}
      </ScrollView>
    </Screen>
  )
}
