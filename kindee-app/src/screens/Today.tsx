import { useRef, useState } from 'react'
import { CalorieRing, Icon, MacroBar, Mascot, OfflineBar } from '../components/ui'
import { foodById } from '../data/foods'
import { MEALS, amountLabel, mealLabel, num, ringTone, totalMacros } from '../lib/calc'
import { useStore } from '../lib/store'
import type { Entry, Meal } from '../lib/types'

const THAI_DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']
const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

function EntryRow({
  entry,
  readOnly,
  onEdit,
  onDelete,
}: {
  entry: Entry
  readOnly: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const food = foodById(entry.foodId)
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const start = useRef(0)
  const base = useRef(0)

  const down = (e: React.PointerEvent) => {
    if (readOnly) return
    start.current = e.clientX
    base.current = dx
    setDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const move = (e: React.PointerEvent) => {
    if (!dragging) return
    const next = Math.min(0, Math.max(-90, base.current + (e.clientX - start.current)))
    setDx(next)
  }
  const up = () => {
    if (!dragging) return
    setDragging(false)
    setDx(dx < -44 ? -84 : 0)
  }

  return (
    <div className="kd-swipe">
      {!readOnly && (
        <div className="kd-swipe-bg" aria-hidden={dx === 0}>
          <button className="kd-swipe-del" onClick={onDelete} aria-label={`ลบ ${food.name}`}>
            <Icon name="ph ph-trash" size={19} />
            ลบ
          </button>
        </div>
      )}
      <div
        className="kd-swipe-fg"
        style={{
          transform: `translateX(${dx}px)`,
          transition: dragging ? 'none' : 'transform .2s ease',
          padding: '12px 14px',
        }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        <button
          onClick={() => dx === 0 && !readOnly && onEdit()}
          style={{ display: 'flex', width: '100%', gap: 12, textAlign: 'left', alignItems: 'center' }}
          disabled={readOnly}
        >
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="kd-clamp2" style={{ fontSize: 15, lineHeight: 1.5 }}>{food.name}</span>
            {food.brand && <span className="kd-caption kd-muted" style={{ display: 'block' }}>{food.brand}</span>}
            <span className="kd-label kd-muted" style={{ display: 'block' }}>
              {amountLabel(entry.amount)} {food.units[entry.unitIx].label}
              {entry.pending && (
                <>
                  {' · '}
                  <span style={{ color: 'var(--accent-pressed)' }}>
                    <Icon name="ph ph-cloud-arrow-up" size={12} /> รอซิงก์
                  </span>
                </>
              )}
            </span>
          </span>
          <span className="tnum" style={{ fontSize: 15, fontWeight: 500 }}>{num(entry.kcal)}</span>
        </button>
      </div>
    </div>
  )
}

export function Today({
  dayOffset,
  onDayChange,
  onAdd,
  onScan,
  onEditEntry,
  loading,
}: {
  dayOffset: number
  onDayChange: (d: number) => void
  onAdd: (meal?: Meal) => void
  onScan: () => void
  onEditEntry: (uid: string) => void
  loading?: boolean
}) {
  const { profile, entriesFor, removeEntry, online, showMacros, pendingCount } = useStore()
  const target = profile?.target ?? 1850

  const d = new Date()
  d.setDate(d.getDate() + dayOffset)
  const dayStr = d.toISOString().slice(0, 10)
  const entries = entriesFor(dayStr)
  const consumed = entries.reduce((s, e) => s + e.kcal, 0)
  const tone = ringTone(consumed, target)
  const over = consumed > target
  const readOnly = dayOffset < 0
  const macros = totalMacros(entries)

  const dateLabel =
    dayOffset === 0 ? 'วันนี้' : `${d.getDate()} ${THAI_MONTHS[d.getMonth()]}`

  return (
    <div className="kd-screen">
      <div style={{ paddingTop: 'var(--safe-top)' }}>
        {!online && <OfflineBar text="ยังไม่ได้ซิงก์ · บันทึกไว้ในเครื่องแล้ว" />}
        {online && pendingCount > 0 && <OfflineBar text={`กำลังซิงก์ ${pendingCount} รายการ`} />}
        {readOnly && (
          <div className="kd-offline" style={{ background: 'var(--border)', color: 'var(--text-body-alt)' }} role="status">
            <Icon name="ph ph-clock-counter-clockwise" size={15} />
            กำลังดูย้อนหลัง — โหมดอ่านอย่างเดียว
          </div>
        )}

        <div className="kd-row" style={{ padding: '4px 8px', gap: 4 }}>
          <button className="kd-icon-btn" onClick={() => onDayChange(dayOffset - 1)} aria-label="วันก่อนหน้า">
            <Icon name="ph ph-caret-left" size={20} />
          </button>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 500 }}>{dateLabel}</div>
            <div className="kd-caption kd-muted">{THAI_DAYS[d.getDay()]}</div>
          </div>
          <button
            className="kd-icon-btn"
            onClick={() => onDayChange(Math.min(0, dayOffset + 1))}
            disabled={dayOffset >= 0}
            aria-label="วันถัดไป"
            style={{ opacity: dayOffset >= 0 ? 0.35 : 1 }}
          >
            <Icon name="ph ph-caret-right" size={20} />
          </button>
          <button className="kd-chip" onClick={onScan} aria-label="สแกนบาร์โค้ด">
            <Icon name="ph ph-barcode" size={18} />
            สแกน
          </button>
        </div>
      </div>

      <div className="kd-scroll" style={{ padding: '0 16px 152px' }}>
        <div style={{ padding: '8px 0 4px' }}>
          <CalorieRing consumed={consumed} target={target} tone={tone} loading={loading} />
          {!loading && (
            <p className="kd-label kd-muted" style={{ textAlign: 'center', marginTop: 4 }}>
              {over
                ? 'ค่าเฉลี่ยสัปดาห์นี้ยังอยู่ในช่วงเป้าหมาย'
                : `บันทึกไปแล้ว ${num(consumed)} kcal จากทั้งวัน`}
            </p>
          )}
        </div>

        {showMacros && !loading && entries.length > 0 && <MacroBar macros={macros} />}

        {loading ? (
          <div style={{ display: 'grid', gap: 10, marginTop: 24 }}>
            {[0, 1, 2].map((i) => <div key={i} className="kd-skel" style={{ height: 66, borderRadius: 16 }} />)}
          </div>
        ) : entries.length === 0 && !readOnly ? (
          <div style={{ textAlign: 'center', marginTop: 24, display: 'grid', gap: 12, justifyItems: 'center' }}>
            <Mascot />
            <h2 className="kd-h2">เริ่มจากมื้อแรกกันเลย</h2>
            <p className="kd-body kd-muted" style={{ maxWidth: 280 }}>
              สแกนบาร์โค้ดของในร้านได้เลย หรือค้นหาชื่ออาหารก็ได้ ใช้เวลาไม่กี่วินาที
            </p>
            <div style={{ display: 'grid', gap: 10, width: '100%', marginTop: 4 }}>
              <button className="kd-btn kd-btn-primary" onClick={onScan}>
                <Icon name="ph ph-barcode" size={20} />
                สแกนบาร์โค้ด
              </button>
              <button className="kd-btn kd-btn-outline" onClick={() => onAdd()}>ค้นหาชื่ออาหาร</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 18, marginTop: 20 }}>
            {MEALS.map((m) => {
              const list = entries.filter((e) => e.meal === m.id)
              if (readOnly && list.length === 0) return null
              const sum = list.reduce((s, e) => s + e.kcal, 0)
              return (
                <section key={m.id}>
                  <div className="kd-row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                    <div className="kd-row" style={{ gap: 8 }}>
                      <h2 className="kd-h2" style={{ opacity: list.length ? 1 : 0.6 }}>{m.label}</h2>
                      {list.length > 0 && <span className="kd-label kd-muted tnum">{num(sum)} kcal</span>}
                    </div>
                    {!readOnly && (
                      <button className="kd-icon-btn" onClick={() => onAdd(m.id)} aria-label={`เพิ่มอาหารมื้อ${m.label}`}>
                        <Icon name="ph ph-plus" size={20} color="var(--accent-pressed)" />
                      </button>
                    )}
                  </div>

                  {list.length === 0 ? (
                    <button
                      onClick={() => onAdd(m.id)}
                      style={{
                        width: '100%',
                        minHeight: 56,
                        border: '1px dashed var(--border-strong)',
                        borderRadius: 'var(--r-card)',
                        color: 'var(--text-muted)',
                        fontSize: 13,
                      }}
                    >
                      ยังไม่มีอะไรในมื้อนี้ · แตะเพื่อเพิ่ม
                    </button>
                  ) : (
                    <div style={{ display: 'grid', gap: 8 }}>
                      {list.map((e) => (
                        <EntryRow
                          key={e.uid}
                          entry={e}
                          readOnly={readOnly}
                          onEdit={() => onEditEntry(e.uid)}
                          onDelete={() => removeEntry(e.uid)}
                        />
                      ))}
                    </div>
                  )}
                </section>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export { mealLabel }
