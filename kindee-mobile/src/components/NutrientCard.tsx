import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Card } from './ui'
import { C, T } from '../theme'
import type { Entry, Profile } from '../lib/types'
import { totalMacros, num } from '../lib/calc'
import { missingNutrients, nutrientTargets, nutrientStatus, nutrientExplanation } from '../lib/nutrients'

export function NutrientCard({ profile, entries, historical = false }: { profile: Profile; entries: Entry[]; historical?: boolean }) {
  const [muscle, setMuscle] = useState(profile.goal === 'gain')
  const [details, setDetails] = useState(false)
  const targets = nutrientTargets(profile, muscle)
  const macros = totalMacros(entries)
  const missing = missingNutrients(entries)
  return <Card style={{ padding: 16, marginTop: 16 }}>
    <Text style={T.h2}>สารอาหารรายวัน</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
      {[false, true].map(mode => <Pressable key={String(mode)} accessibilityRole="button" accessibilityState={{ selected: muscle === mode }} onPress={() => setMuscle(mode)} style={{ padding: 10, borderRadius: 16, backgroundColor: muscle === mode ? C.accentTint : C.border }}><Text style={{ color: C.text }}>{mode ? 'ดูแลกล้ามเนื้อ' : 'ทั่วไป'}</Text></Pressable>)}
    </View>
    <Text style={[T.caption, T.muted, { marginTop: 10 }]}>อิงน้ำหนัก {num(profile.weight)} กก. และเป้าพลังงาน {num(profile.target)} kcal{historical ? ' ปัจจุบัน (ไม่ได้บันทึกเป้าในอดีต)' : ''}</Text>
    {muscle && <Text style={[T.caption, { marginTop: 8, color: C.text }]}>ผู้ใหญ่ที่ออกกำลังกาย: โปรตีนประมาณ {num(profile.weight * 1.4)}–{num(profile.weight * 2)} ก./วัน (1.4–2.0 ก./กก.) แผนนี้ใช้ 1.6 ก./กก.</Text>}
    {targets ? (['protein', 'carb', 'fat'] as const).map((key, i) => <View key={key} style={{ marginTop: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}><Text style={{ color: C.text }}>{['โปรตีน', 'คาร์บ', 'ไขมัน'][i]}</Text><Text style={[T.tnum, { color: C.text }]}>{num(macros[key])} / {num(targets[key])} ก.</Text></View>
      <View style={{ height: 5, borderRadius: 10, backgroundColor: C.border, marginTop: 5 }}><View style={{ height: 5, borderRadius: 10, backgroundColor: C.statusNear, width: `${Math.min(100, macros[key] / (targets[key] || 1) * 100)}%` }} /></View>
      <Text style={[T.caption, T.muted, { marginTop: 4 }]}>{nutrientStatus(macros[key], targets[key], key === 'protein')}</Text>
    </View>) : <Text style={[T.caption, { marginTop: 10, color: C.text }]}>น้ำหนักกับงบพลังงานนี้ยังจัดสัดส่วนแผนไม่ได้ ลองตรวจข้อมูลและเป้าแคลอรีในหน้าโปรไฟล์ หรือปรึกษานักกำหนดอาหาร</Text>}
    {missing > 0 && <Text style={[T.caption, { marginTop: 10, color: C.text }]}>มี {missing} รายการที่ข้อมูลสารอาหารไม่ครบ ยอดที่แสดงอาจต่ำกว่าที่กินจริง</Text>}
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: details }} onPress={() => setDetails(!details)} style={{ paddingVertical: 12 }}><Text style={[T.caption, { color: C.accentPressed }]}>วิธีคำนวณและแหล่งอ้างอิง {details ? '−' : '+'}</Text></Pressable>
    {details && <Text style={[T.caption, T.muted]}>ทั่วไปใช้โปรตีนอย่างน้อย 0.8 ก./กก. และอย่างน้อย 10% ของพลังงาน ไขมัน 30% ของพลังงาน ส่วนที่เหลือเป็นคาร์บ {nutrientExplanation}{'\n\n'}อ้างอิง: ISSN — Protein and exercise (2017); National Academies — Dietary Reference Intakes (2005)</Text>}
  </Card>
}
