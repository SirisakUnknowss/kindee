import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../components/ui'
import { ACTIVITY, GOALS, computeTarget, num } from '../lib/calc'
import type { Profile } from '../lib/types'
import { TDEE_EXPLAINER } from '../content/tdee'
import { legalConfig } from '../config/legal'

const MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
const YEARS = Array.from({ length: 2008 - 1970 + 1 }, (_, i) => 1970 + i)
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1)

const DEFAULT: Profile = {
  sex: 'female',
  bDay: 15,
  bMonth: 6,
  bYear: 1995,
  height: 165,
  weight: 60,
  activity: 'light',
  goal: 'keep',
  target: 1850,
  targetSource: 'auto',
}



function SliderField({
  label,
  unit,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string
  unit: string
  min: number
  max: number
  step: number
  value: number
  onChange: (v: number) => void
}) {
  const id = useRef(`sl-${label}`).current
  const [draft, setDraft] = useState(String(value))
  const editing = useRef(false)

  useEffect(() => {
    if (!editing.current) setDraft(String(value))
  }, [value])

  const commit = () => {
    editing.current = false
    const parsed = Number(draft)
    if (draft.trim() === '' || !Number.isFinite(parsed)) {
      setDraft(String(value))
      return
    }
    const decimals = String(step).split('.')[1]?.length ?? 0
    const clamped = Math.min(max, Math.max(min, parsed))
    const next = Number((Math.round(clamped / step) * step).toFixed(decimals))
    onChange(next)
    setDraft(String(next))
  }

  return (
    <div>
      <div className="kd-row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
        <label className="kd-field-label" htmlFor={id} style={{ marginBottom: 0 }}>{label}</label>
        <div className="kd-row" style={{ gap: 6 }}>
          <input
            className="kd-input tnum"
            style={{ width: 84, minHeight: 48, textAlign: 'right', padding: '0 10px' }}
            type="number"
            inputMode="decimal"
            min={min}
            max={max}
            step={step}
            value={draft}
            aria-label={`${label} (${unit})`}
            onFocus={() => { editing.current = true }}
            onChange={(e) => {
              const next = e.target.value
              setDraft(next)
              const parsed = Number(next)
              if (next !== '' && Number.isFinite(parsed) && parsed >= min && parsed <= max) onChange(parsed)
            }}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
          />
          <span className="kd-label kd-muted">{unit}</span>
        </div>
      </div>
      <input
        id={id}
        className="kd-range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => {
          const next = Number(e.target.value)
          editing.current = false
          setDraft(String(next))
          onChange(next)
        }}
      />
      <div className="kd-row" style={{ justifyContent: 'space-between' }}>
        <span className="kd-caption kd-muted tnum">{min}</span>
        <span className="kd-caption kd-muted tnum">{max}</span>
      </div>
    </div>
  )
}

export function Onboarding({
  initial,
  editMode,
  onDone,
  onCancel,
}: {
  initial?: Profile | null
  editMode?: boolean
  onDone: (p: Profile) => void
  onCancel?: () => void
}) {
  const [p, setP] = useState<Profile>(initial ?? DEFAULT)
  const [step, setStep] = useState(editMode ? 5 : 1)
  const [manualOpen, setManualOpen] = useState(initial?.targetSource === 'manual')
  const [manual, setManual] = useState(initial?.targetSource === 'manual' ? String(initial.target) : '')
  const [ageRestricted, setAgeRestricted] = useState(false)

  const calc = useMemo(() => computeTarget(p), [p])
  const target = manualOpen && Number(manual) > 0 ? Math.round(Number(manual)) : calc.target
  const source: Profile['targetSource'] = manualOpen && Number(manual) > 0 ? 'manual' : 'auto'
  const set = (patch: Partial<Profile>) => setP((v) => ({ ...v, ...patch }))

  const next = () => {
    if (!editMode && step === 1 && calc.age < 18) {
      setAgeRestricted(true)
      return
    }
    setAgeRestricted(false)
    if (step < 5) return setStep(step + 1)
    onDone({ ...p, target, targetSource: source })
  }
  const back = () => (step > 1 ? setStep(step - 1) : onCancel?.())

  const manualBelowFloor = source === 'manual' && target < calc.floor

  return (
    <div className="kd-screen" style={{ zIndex: 7 }}>
      <div style={{ paddingTop: 'var(--safe-top)' }}>
        <div className="kd-steps" style={{ marginTop: 8 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <i key={i} className={i <= step ? 'on' : ''} />
          ))}
        </div>
        <div className="kd-row" style={{ padding: '4px 8px' }}>
          <button className="kd-icon-btn" onClick={back} aria-label="ย้อนกลับ">
            <Icon name="ph ph-caret-left" size={22} />
          </button>
          <span className="kd-label kd-muted">ขั้นที่ {step} จาก 5</span>
        </div>
      </div>

      <div className="kd-scroll" style={{ padding: '4px 16px 24px' }}>
        {step === 1 && (
          <>
            <h1 className="kd-h1">ขอข้อมูลพื้นฐานหน่อย</h1>
            <p className="kd-body kd-muted" style={{ marginTop: 4 }}>
              ใช้ในสูตรคำนวณพลังงานที่ร่างกายใช้ต่อวัน เก็บไว้ในบัญชีของคุณเท่านั้น
            </p>
            <div style={{ display: 'grid', gap: 10, margin: '20px 0 24px', gridTemplateColumns: '1fr 1fr' }}>
              {([['female', 'หญิง', 'ph ph-gender-female'], ['male', 'ชาย', 'ph ph-gender-male']] as const).map(
                ([id, label, icon]) => (
                  <button
                    key={id}
                    className={`kd-card-select${p.sex === id ? ' on' : ''}`}
                    style={{ minHeight: 76, flexDirection: 'column', justifyContent: 'center', gap: 6 }}
                    aria-label={label}
                    aria-pressed={p.sex === id}
                    onClick={() => set({ sex: id })}
                  >
                    <Icon name={icon} size={24} color="var(--accent-pressed)" />
                    <span style={{ fontSize: 15 }}>{label}</span>
                  </button>
                ),
              )}
            </div>

            <div className="kd-row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
              <span className="kd-h2">วันเกิด</span>
              <span className="kd-label kd-muted tnum">อายุ {calc.age} ปี</span>
            </div>

            {/* 3-Column Dropdown Select (วัน / เดือน / ปี พ.ศ.-ค.ศ.) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr 1.2fr', gap: 8, marginBottom: 12 }}>
              <div>
                <label className="kd-field-label">วัน</label>
                <select
                  className="kd-select tnum"
                  value={p.bDay}
                  onChange={(e) => set({ bDay: Number(e.target.value) })}
                >
                  {DAYS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="kd-field-label">เดือน</label>
                <select
                  className="kd-select"
                  value={p.bMonth}
                  onChange={(e) => set({ bMonth: Number(e.target.value) })}
                >
                  {MONTHS.map((m, i) => (
                    <option key={i + 1} value={i + 1}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="kd-field-label">ปีเกิด</label>
                <select
                  className="kd-select tnum"
                  value={p.bYear}
                  onChange={(e) => set({ bYear: Number(e.target.value) })}
                >
                  {YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y} ({y + 543})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Calendar Native Picker Choice */}
            <div className="kd-row" style={{ gap: 8, marginTop: 4, alignItems: 'center' }}>
              <Icon name="ph ph-calendar" size={18} color="var(--text-muted)" />
              <span className="kd-caption kd-muted">หรือเลือกจากปฏิทิน:</span>
              <input
                type="date"
                className="kd-input tnum"
                style={{ minHeight: 38, padding: '0 10px', fontSize: 13, width: 'auto' }}
                value={`${p.bYear}-${String(p.bMonth).padStart(2, '0')}-${String(p.bDay).padStart(2, '0')}`}
                onChange={(e) => {
                  if (!e.target.value) return
                  const [y, m, d] = e.target.value.split('-').map(Number)
                  if (y && m && d) set({ bYear: y, bMonth: m, bDay: d })
                }}
              />
            </div>
            {ageRestricted && (
              <div role="alert" style={{ marginTop: 14, padding: 12, borderRadius: 12, background: '#fff1f1', color: '#8d2f2f', textAlign: 'left' }}>
                KinDee เปิดให้ใช้สำหรับผู้มีอายุ 18 ปีขึ้นไปเท่านั้น หากผู้ปกครองต้องการให้ลบข้อมูลที่เด็กเคยส่ง โปรดติดต่อ {legalConfig.privacyEmail}
              </div>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="kd-h1">ร่างกายตอนนี้</h1>
            <p className="kd-body kd-muted" style={{ marginTop: 4 }}>
              เลื่อนหรือพิมพ์ก็ได้ ปรับทีหลังได้ตลอด
            </p>
            <div style={{ display: 'grid', gap: 28, marginTop: 24 }}>
              <SliderField label="ส่วนสูง" unit="ซม." min={130} max={200} step={1} value={p.height} onChange={(v) => set({ height: v })} />
              <SliderField label="น้ำหนักตอนนี้" unit="กก." min={35} max={150} step={0.1} value={p.weight} onChange={(v) => set({ weight: v })} />
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="kd-h1">ปกติขยับตัวแค่ไหน</h1>
            <p className="kd-body kd-muted" style={{ marginTop: 4 }}>เลือกอันที่ใกล้เคียงชีวิตจริงที่สุด</p>
            <div style={{ display: 'grid', gap: 10, marginTop: 20 }}>
              {ACTIVITY.map((a) => (
                <button
                  key={a.id}
                  className={`kd-card-select${p.activity === a.id ? ' on' : ''}`}
                  aria-pressed={p.activity === a.id}
                  onClick={() => set({ activity: a.id })}
                >
                  <Icon name={a.icon} size={24} color="var(--accent-pressed)" />
                  <span style={{ flex: 1 }}>
                    <span style={{ display: 'block', fontSize: 15 }}>{a.label}</span>
                    <span className="kd-label kd-muted">{a.desc}</span>
                  </span>
                  <Icon
                    name={p.activity === a.id ? 'ph-fill ph-check-circle' : 'ph ph-circle'}
                    size={22}
                    color={p.activity === a.id ? 'var(--accent)' : 'var(--border-strong)'}
                  />
                </button>
              ))}
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <h1 className="kd-h1">อยากให้เราช่วยเรื่องอะไร</h1>
            <p className="kd-body kd-muted" style={{ marginTop: 4 }}>ทุกทางเลือกใช้ได้ดีเท่ากัน เปลี่ยนทีหลังได้</p>
            <div style={{ display: 'grid', gap: 10, marginTop: 20 }}>
              {GOALS.map((g) => (
                <button
                  key={g.id}
                  className={`kd-card-select${p.goal === g.id ? ' on' : ''}`}
                  aria-pressed={p.goal === g.id}
                  onClick={() => set({ goal: g.id })}
                >
                  <Icon name={g.icon} size={24} color="var(--accent-pressed)" />
                  <span style={{ flex: 1 }}>
                    <span style={{ display: 'block', fontSize: 15 }}>{g.label}</span>
                    <span className="kd-label kd-muted">{g.desc}</span>
                  </span>
                  <Icon
                    name={p.goal === g.id ? 'ph-fill ph-check-circle' : 'ph ph-circle'}
                    size={22}
                    color={p.goal === g.id ? 'var(--accent)' : 'var(--border-strong)'}
                  />
                </button>
              ))}
            </div>
          </>
        )}

        {step === 5 && (
          <>
            <h1 className="kd-h1">เป้าหมายของคุณ</h1>
            <div className="kd-card" style={{ padding: 20, textAlign: 'center', margin: '16px 0 20px' }}>
              <div className="kd-display tnum">{num(target)}</div>
              <div className="kd-label kd-muted" style={{ marginTop: 4 }}>
                kcal ต่อวัน · {source === 'manual' ? 'ตั้งเอง' : 'คำนวณอัตโนมัติ'}
              </div>
            </div>

            <div className="kd-card" style={{ padding: 14, marginBottom: 16 }}>
              <div className="kd-row" style={{ alignItems: 'flex-start', gap: 10 }}>
                <Icon name="ph ph-wallet" size={22} color="var(--accent-pressed)" />
                <div>
                  <h2 className="kd-h2">{TDEE_EXPLAINER.title}</h2>
                  <p className="kd-body kd-muted" style={{ marginTop: 4 }}>{TDEE_EXPLAINER.intro}</p>
                </div>
              </div>
              <details className="kd-details">
                <summary>ดูวิธีคิดแบบบัญชีและตัวอย่าง</summary>
                <div className="kd-details-body">
                  <ul>
                    {TDEE_EXPLAINER.budget.map((item) => (
                      <li key={item.label}><b>{item.label}</b> = {item.detail}</li>
                    ))}
                  </ul>
                  <p><b>{TDEE_EXPLAINER.exampleTitle}</b></p>
                  <ul>{TDEE_EXPLAINER.examples.map((example) => <li key={example}>{example}</li>)}</ul>
                  <p>{TDEE_EXPLAINER.variableNote}</p>
                  <p>{TDEE_EXPLAINER.allocation}</p>
                  <p className="kd-caption kd-muted">เป้าที่ KinDee แสดงด้านบนคือ TDEE ที่ปรับตามเป้าหมายลด คง หรือเพิ่มน้ำหนักแล้ว</p>
                </div>
              </details>
            </div>

            <h2 className="kd-h2" style={{ marginBottom: 8 }}>ตัวเลขนี้มาจากไหน</h2>
            <div className="kd-card" style={{ padding: '4px 14px' }}>
              {[
                ['พลังงานพื้นฐาน (BMR)', num(calc.bmr), `Mifflin–St Jeor · ${p.weight} กก. · ${p.height} ซม. · ${calc.age} ปี`],
                ['คูณระดับกิจกรรม', num(calc.tdee), ACTIVITY.find((a) => a.id === p.activity)!.label],
                ['ปรับตามเป้าหมาย', num(calc.raw), GOALS.find((g) => g.id === p.goal)!.label],
              ].map(([label, value, note]) => (
                <div key={label} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <div className="kd-row" style={{ justifyContent: 'space-between', gap: 12 }}>
                    <span className="kd-body">{label}</span>
                    <span className="kd-body tnum" style={{ fontWeight: 500 }}>{value}</span>
                  </div>
                  <div className="kd-caption kd-muted">{note}</div>
                </div>
              ))}
              <div className="kd-row" style={{ justifyContent: 'space-between', padding: '12px 0' }}>
                <span className="kd-body" style={{ fontWeight: 500 }}>เป้าที่ใช้</span>
                <span className="kd-body tnum" style={{ fontWeight: 500 }}>{num(target)} kcal</span>
              </div>
            </div>

            {(calc.floored || manualBelowFloor) && (
              <div
                style={{
                  background: 'var(--accent-tint-soft)',
                  border: '1px solid var(--accent-line)',
                  borderRadius: 'var(--r-card)',
                  padding: 14,
                  marginTop: 14,
                  display: 'flex',
                  gap: 10,
                }}
                role="status"
              >
                <Icon name="ph ph-heart" size={20} color="var(--accent-pressed)" />
                <p className="kd-body" style={{ color: 'var(--text-body-alt)' }}>
                  {manualBelowFloor
                    ? `เป้าที่ตั้งไว้ต่ำกว่า ${num(calc.floor)} kcal ซึ่งต่ำกว่านี้ร่างกายมักได้สารอาหารไม่ครบ ถ้าอยากได้เป้าที่ต่ำกว่านี้จริง ๆ คุยกับแพทย์หรือนักกำหนดอาหารก่อนน่าจะดีที่สุด`
                    : `ปรับขึ้นมาที่ ${num(calc.floor)} kcal ให้แล้ว เพราะต่ำกว่านี้ร่างกายมักได้สารอาหารไม่ครบ ถ้าอยากได้เป้าที่ต่ำกว่านี้จริง ๆ คุยกับแพทย์หรือนักกำหนดอาหารก่อนน่าจะดีที่สุด`}
                </p>
              </div>
            )}

            {manualOpen ? (
              <div style={{ marginTop: 14 }}>
                <label className="kd-field-label" htmlFor="ob-manual">เป้าที่อยากตั้งเอง (kcal ต่อวัน)</label>
                <input
                  id="ob-manual"
                  className="kd-input tnum"
                  type="number"
                  inputMode="numeric"
                  placeholder={String(calc.target)}
                  value={manual}
                  onChange={(e) => setManual(e.target.value)}
                />
              </div>
            ) : (
              <button className="kd-btn-text" style={{ marginTop: 8 }} onClick={() => { setManualOpen(true); setManual(String(calc.target)) }}>
                ปรับเอง — มีเป้าจากนักโภชนาการอยู่แล้ว
              </button>
            )}
          </>
        )}
      </div>

      <div
        style={{
          background: 'var(--surface)',
          borderTop: '1px solid var(--border)',
          padding: '12px 16px var(--safe-bottom)',
        }}
      >
        <button className="kd-btn kd-btn-primary" onClick={next}>
          {step < 5 ? 'ถัดไป' : editMode ? 'บันทึกเป้าหมาย' : 'เริ่มใช้งาน'}
        </button>
        <p className="kd-caption kd-muted" style={{ textAlign: 'center', marginTop: 8 }}>
          ทุกค่าจำเป็นต่อการคำนวณ เลยยังข้ามไม่ได้ ขอโทษด้วยนะ
        </p>
      </div>
    </div>
  )
}
