import { useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { Button, Chip, Field, Icon, QualityBadge, Row, Sheet, TextButton, Thumb } from '../components/ui'
import { foodById } from '../data/foods'
import { amountLabel, mealLabel, num } from '../lib/calc'
import type { Meal } from '../lib/types'
import { C, T } from '../theme'

const QUICK = [0.5, 1, 1.5, 2]

/** เลือกปริมาณ + แก้ไขรายการ — โหมด A อาหารปรุงสำเร็จ (หน่วยไทย) / โหมด B สินค้าบรรจุภัณฑ์ */
export function QtySheet({ foodId, meal, mealTotal, editing, initialUnitIx, initialAmount, onClose, onSave, onDelete }: {
  foodId: string
  meal: Meal
  mealTotal: number
  editing?: boolean
  initialUnitIx?: number
  initialAmount?: number
  onClose: () => void
  onSave: (unitIx: number, amount: number) => void
  onDelete?: () => void
}) {
  const food = foodById(foodId)
  const packaged = food.kind === 'pack'
  const [unitIx, setUnitIx] = useState(initialUnitIx ?? 0)
  const [amount, setAmount] = useState(initialAmount ?? 1)
  const [gramOpen, setGramOpen] = useState(false)
  const [gram, setGram] = useState('')

  const unit = food.units[unitIx]
  const kcal = Math.round(food.kcal * unit.f * amount)
  // ฉลากระบุหน่วยบริโภคต่างจากขนาดบรรจุ — จุดที่คนนับผิดบ่อยที่สุด
  const servingMismatch = packaged && (food.servings ?? 1) > 1

  const applyGrams = (text: string) => {
    setGram(text)
    // The first unit is a labelled serving; derive grams-per-serving from its label.
    const g = Number(text)
    const match = /\((\d+(?:\.\d+)?)\s*ก\.\)/.exec(food.units[0].label)
    if (g > 0 && match) {
      setUnitIx(0)
      setAmount(Math.round((g / Number(match[1])) * 100) / 100)
    }
  }

  return (
    <Sheet onClose={onClose}>
      <ScrollView keyboardShouldPersistTaps="handled" bounces={false}>
        <Row style={{ gap: 12, alignItems: 'flex-start' }}>
          <Thumb food={food} />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={2} style={{ fontSize: 15.5, fontWeight: '500', lineHeight: 23, color: C.text }}>{food.name}</Text>
            <Text style={[T.caption, T.muted]}>
              {packaged ? food.pack : `อาหารปรุงสำเร็จ${food.updated ? ` · อัปเดต ${food.updated}` : ''}`}
            </Text>
            <QualityBadge q={food.q} />
          </View>
        </Row>

        <Text style={[T.label, { fontWeight: '500', marginTop: 18, marginBottom: 8 }]}>{packaged ? 'นับแบบไหน' : 'หน่วย'}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {food.units.map((u, i) => <Chip key={u.label} on={i === unitIx} onPress={() => setUnitIx(i)}>{u.label}</Chip>)}
        </ScrollView>

        {servingMismatch && (
          <Row accessibilityRole="alert" style={{ gap: 8, alignItems: 'flex-start', backgroundColor: C.accentTintSoft, borderWidth: 1, borderColor: C.accentLine, borderRadius: 12, padding: 10, marginTop: 10 }}>
            <Icon name="ph ph-info" size={16} color={C.accentPressed} />
            <Text style={[T.caption, { flex: 1, color: C.bodyAlt }]}>
              ฉลากระบุ {food.servings} หน่วยบริโภคต่อบรรจุภัณฑ์ ตอนนี้กำลังนับแบบ “{unit.label}” ({num(Math.round(food.kcal * unit.f))} kcal)
            </Text>
          </Row>
        )}

        <Text style={[T.label, { fontWeight: '500', marginTop: 18, marginBottom: 8 }]}>จำนวน</Text>
        <Row style={{ gap: 8 }}>
          {QUICK.map((q) => (
            <Chip key={q} on={amount === q} onPress={() => setAmount(q)} style={{ flex: 1, minHeight: 48, borderRadius: 12 }}>{amountLabel(q)}</Chip>
          ))}
        </Row>

        {!packaged && (gramOpen ? (
          <View style={{ marginTop: 12 }}>
            <Field label="ระบุเป็นกรัม" keyboardType="number-pad" placeholder="เช่น 250" value={gram} onChangeText={applyGrams} />
          </View>
        ) : (
          <TextButton onPress={() => setGramOpen(true)} style={{ alignSelf: 'flex-start', marginTop: 6 }}>ระบุเป็นกรัม</TextButton>
        ))}

        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.border }}>
          <View>
            <Text style={[T.caption, T.muted]}>รวมมื้อ{mealLabel(meal)}</Text>
            <Text style={[T.body, T.tnum]}>{num(mealTotal + (editing ? 0 : kcal))} kcal</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[T.caption, T.muted]}>รายการนี้</Text>
            <Text style={[{ fontSize: 26, fontWeight: '500', color: C.text }, T.tnum]}>{num(kcal)}</Text>
          </View>
        </Row>

        <Row style={{ gap: 10, marginTop: 14 }}>
          {editing && onDelete ? (
            <Button variant="danger" onPress={onDelete} accessibilityLabel="ลบรายการนี้" style={{ width: 52, paddingHorizontal: 0 }} icon={<Icon name="ph ph-trash" size={20} color={C.danger} />} />
          ) : null}
          <Button style={{ flex: 1 }} onPress={() => onSave(unitIx, amount)}>
            {editing ? 'บันทึกการแก้ไข' : `บันทึกลงมื้อ${mealLabel(meal)}`}
          </Button>
        </Row>
      </ScrollView>
    </Sheet>
  )
}
