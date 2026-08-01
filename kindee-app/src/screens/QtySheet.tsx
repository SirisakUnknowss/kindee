import { useState } from 'react'
import { Icon, QualityBadge, Sheet, Thumb } from '../components/ui'
import { foodById } from '../data/foods'
import { amountLabel, mealLabel, num } from '../lib/calc'
import type { Meal } from '../lib/types'

const QUICK = [0.5, 1, 1.5, 2]

/**
 * หน้า 18 เลือกปริมาณ + หน้า 20 แก้ไขรายการ — component เดียว
 * โหมด A อาหารปรุงสำเร็จ (หน่วยไทย) / โหมด B สินค้าบรรจุภัณฑ์ (หน่วยบรรจุ)
 */
export function QtySheet({
  foodId,
  meal,
  mealTotal,
  editing,
  initialUnitIx,
  initialAmount,
  onClose,
  onSave,
  onDelete,
}: {
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

  const kcal = Math.round(food.kcal * food.units[unitIx].f * amount)
  const unit = food.units[unitIx]
  // ฉลากระบุหน่วยบริโภคต่างจากขนาดบรรจุ — จุดที่คนนับผิดบ่อยที่สุด
  const servingMismatch = packaged && (food.servings ?? 1) > 1

  return (
    <Sheet onClose={onClose} labelledBy="qty-title">
      <div className="kd-row" style={{ gap: 12, alignItems: 'flex-start' }}>
        <Thumb food={food} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div id="qty-title" className="kd-clamp2" style={{ fontSize: 15.5, fontWeight: 500, lineHeight: 1.5 }}>
            {food.name}
          </div>
          <div className="kd-caption kd-muted">
            {packaged ? food.pack : `อาหารปรุงสำเร็จ${food.updated ? ` · อัปเดต ${food.updated}` : ''}`}
          </div>
          <div style={{ marginTop: 2 }}><QualityBadge q={food.q} /></div>
        </div>
      </div>

      <h2 className="kd-label" style={{ margin: '18px 0 8px', fontWeight: 500 }}>
        {packaged ? 'นับแบบไหน' : 'หน่วย'}
      </h2>
      <div className="kd-hscroll">
        {food.units.map((u, i) => (
          <button
            key={u.label}
            className={`kd-chip${i === unitIx ? ' on' : ''}`}
            aria-pressed={i === unitIx}
            onClick={() => setUnitIx(i)}
          >
            {u.label}
          </button>
        ))}
      </div>

      {servingMismatch && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            background: 'var(--accent-tint-soft)',
            border: '1px solid #d2cefd',
            borderRadius: 12,
            padding: 10,
            marginTop: 10,
          }}
          role="status"
        >
          <Icon name="ph ph-info" size={16} color="var(--accent-pressed)" />
          <p className="kd-caption" style={{ color: 'var(--text-body-alt)' }}>
            ฉลากระบุ {food.servings} หน่วยบริโภคต่อบรรจุภัณฑ์ ตอนนี้กำลังนับแบบ
            <b style={{ fontWeight: 500 }}> “{unit.label}” </b>
            ({num(Math.round(food.kcal * unit.f))} kcal)
          </p>
        </div>
      )}

      <h2 className="kd-label" style={{ margin: '18px 0 8px', fontWeight: 500 }}>จำนวน</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {QUICK.map((q) => (
          <button
            key={q}
            className={`kd-chip${amount === q ? ' on' : ''}`}
            style={{ minHeight: 48, borderRadius: 12 }}
            aria-pressed={amount === q}
            onClick={() => setAmount(q)}
          >
            {amountLabel(q)}
          </button>
        ))}
      </div>

      {!packaged &&
        (gramOpen ? (
          <div style={{ marginTop: 12 }}>
            <label className="kd-field-label" htmlFor="qty-gram">ระบุเป็นกรัม</label>
            <input
              id="qty-gram"
              className="kd-input tnum"
              type="number"
              inputMode="numeric"
              placeholder="เช่น 250"
              value={gram}
              onChange={(e) => setGram(e.target.value)}
            />
          </div>
        ) : (
          <button className="kd-btn-text" style={{ marginTop: 6 }} onClick={() => setGramOpen(true)}>
            ระบุเป็นกรัม
          </button>
        ))}

      <div
        className="kd-row"
        style={{ justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border)' }}
      >
        <div>
          <div className="kd-caption kd-muted">รวมมื้อ{mealLabel(meal)}</div>
          <div className="kd-body tnum">{num(mealTotal + (editing ? 0 : kcal))} kcal</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="kd-caption kd-muted">รายการนี้</div>
          <div className="tnum" style={{ fontSize: 26, fontWeight: 500, lineHeight: 1.2 }}>{num(kcal)}</div>
        </div>
      </div>

      <div className="kd-row" style={{ gap: 10, marginTop: 14 }}>
        {editing && onDelete && (
          <button
            className="kd-btn kd-btn-danger"
            style={{ width: 52, minWidth: 52, flex: 'none' }}
            onClick={onDelete}
            aria-label="ลบรายการนี้"
          >
            <Icon name="ph ph-trash" size={20} />
          </button>
        )}
        <button className="kd-btn kd-btn-primary" onClick={() => onSave(unitIx, amount)}>
          {editing ? 'บันทึกการแก้ไข' : `บันทึกลงมื้อ${mealLabel(meal)}`}
        </button>
      </div>
    </Sheet>
  )
}
