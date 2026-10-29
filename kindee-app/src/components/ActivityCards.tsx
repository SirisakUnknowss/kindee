import { useState } from 'react'
import { Icon, Sheet } from './ui'
import { EXERCISE_PRESETS, WATER_STEP, defaultWaterGoal, exerciseKcal } from '../lib/activity'
import { num } from '../lib/calc'
import { useStore } from '../lib/store'

export function WaterCard({ day, readOnly }: { day: string; readOnly: boolean }) {
  const { water, addWater, waterGoal, setWaterGoal, profile } = useStore()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const goal = waterGoal ?? defaultWaterGoal(profile?.weight)
  const drunk = water[day] ?? 0
  const glasses = Math.ceil(goal / WATER_STEP)

  const saveGoal = () => {
    const ml = Math.round(Number(draft))
    if (Number.isFinite(ml) && ml >= 500 && ml <= 6000) setWaterGoal(ml)
    setEditing(false)
  }

  return (
    <section className="kd-card kd-activity-card" aria-label="น้ำดื่ม">
      <div className="kd-row" style={{ justifyContent: 'space-between', gap: 8 }}>
        <div className="kd-row" style={{ gap: 8 }}>
          <Icon name="ph-fill ph-drop" size={20} color="var(--water, #3b8fd9)" />
          <h2 className="kd-h2">น้ำดื่ม</h2>
        </div>
        <button className="kd-btn-text" onClick={() => { setDraft(String(goal)); setEditing(true) }}>
          เป้า {num(goal)} มล.
        </button>
      </div>
      <div className="kd-row" style={{ gap: 12, marginTop: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <strong className="tnum" style={{ fontSize: 22 }}>{num(drunk)}</strong>
          <span className="kd-caption kd-muted"> / {num(goal)} มล.</span>
          <div className="kd-water-glasses" aria-hidden="true">
            {Array.from({ length: Math.min(glasses, 16) }, (_, i) => (
              <i key={i} className={(i + 1) * WATER_STEP <= drunk ? 'on' : ''} />
            ))}
          </div>
          {drunk >= goal && <p className="kd-caption" style={{ color: 'var(--accent-pressed)', marginTop: 4 }}>ถึงเป้าน้ำวันนี้แล้ว</p>}
        </div>
        {!readOnly && (
          <div className="kd-row" style={{ gap: 6 }}>
            <button className="kd-icon-btn kd-water-minus" disabled={drunk <= 0} onClick={() => addWater(day, -WATER_STEP)} aria-label={`ลดน้ำ ${WATER_STEP} มล.`}>
              <Icon name="ph ph-minus" size={18} />
            </button>
            <button className="kd-btn kd-btn-primary kd-water-plus" onClick={() => addWater(day, WATER_STEP)}>
              <Icon name="ph ph-plus" size={18} /> {WATER_STEP} มล.
            </button>
          </div>
        )}
      </div>

      {editing && (
        <Sheet onClose={() => setEditing(false)} labelledBy="water-goal-title">
          <div style={{ padding: '4px 20px 24px', display: 'grid', gap: 12 }}>
            <h2 id="water-goal-title" className="kd-h2">เป้าน้ำดื่มต่อวัน</h2>
            <p className="kd-caption kd-muted">
              ค่าเริ่มต้นราว 30 มล. ต่อน้ำหนัก 1 กก. ({num(defaultWaterGoal(profile?.weight))} มล.) ปรับได้ 500–6,000 มล.
              ถ้ามีโรคไตหรือหัวใจ ให้ใช้ตามที่แพทย์แนะนำ
            </p>
            <input className="kd-input" type="number" inputMode="numeric" min={500} max={6000} step={250} value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="เป้าน้ำดื่ม (มล.)" />
            <button className="kd-btn kd-btn-primary" onClick={saveGoal}>บันทึกเป้า</button>
            {waterGoal != null && (
              <button className="kd-btn-text" onClick={() => { setWaterGoal(null); setEditing(false) }}>ใช้ค่าจากน้ำหนักตัว</button>
            )}
          </div>
        </Sheet>
      )}
    </section>
  )
}

export function ExerciseCard({ day, readOnly }: { day: string; readOnly: boolean }) {
  const { exercisesFor, addExercise, removeExercise, exerciseMode, setExerciseMode, profile, showToast } = useStore()
  const [open, setOpen] = useState(false)
  const [preset, setPreset] = useState<string>(EXERCISE_PRESETS[0].id)
  const [name, setName] = useState('')
  const [minutes, setMinutes] = useState('30')
  const [kcalDraft, setKcalDraft] = useState('')
  const list = exercisesFor(day)
  const burned = list.reduce((s, e) => s + e.kcal, 0)
  const weight = profile?.weight ?? 60
  const chosen = EXERCISE_PRESETS.find((p) => p.id === preset)
  const mins = Number(minutes)
  const estimate = chosen ? exerciseKcal(chosen.met, weight, mins) : 0
  const kcal = kcalDraft.trim() ? Math.round(Number(kcalDraft)) : estimate
  const label = preset === 'other' ? name.trim() : chosen?.label ?? ''
  const valid = label.length > 0 && Number.isFinite(kcal) && kcal >= 0 && kcal <= 5000 && (!minutes || (mins >= 1 && mins <= 1440))

  const save = () => {
    if (!valid) return
    addExercise({ day, name: label, minutes: mins > 0 ? Math.round(mins) : undefined, kcal })
    showToast(`บันทึก${label} ${num(kcal)} kcal แล้ว`)
    setOpen(false)
    setKcalDraft('')
    setName('')
  }

  return (
    <section className="kd-card kd-activity-card" aria-label="ออกกำลังกาย">
      <div className="kd-row" style={{ justifyContent: 'space-between', gap: 8 }}>
        <div className="kd-row" style={{ gap: 8 }}>
          <Icon name="ph-fill ph-person-simple-run" size={20} color="var(--accent-pressed)" />
          <h2 className="kd-h2">ออกกำลังกาย</h2>
          {burned > 0 && <span className="kd-label kd-muted tnum">เผาไป {num(burned)} kcal</span>}
        </div>
        {!readOnly && (
          <button className="kd-icon-btn" onClick={() => setOpen(true)} aria-label="บันทึกการออกกำลังกาย">
            <Icon name="ph ph-plus" size={20} color="var(--accent-pressed)" />
          </button>
        )}
      </div>

      {list.length > 0 ? (
        <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
          {list.map((e) => (
            <div key={e.uid} className="kd-row" style={{ gap: 8 }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                {e.name}{e.minutes ? <span className="kd-caption kd-muted"> · {e.minutes} นาที</span> : null}
              </span>
              <span className="tnum kd-ledger-credit">{num(e.kcal)} kcal</span>
              {!readOnly && (
                <button className="kd-icon-btn" onClick={() => removeExercise(e.uid)} aria-label={`ลบ ${e.name}`}>
                  <Icon name="ph ph-x" size={16} color="var(--text-muted)" />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="kd-caption kd-muted" style={{ marginTop: 6 }}>ยังไม่ได้บันทึกกิจกรรม{readOnly ? '' : ' · แตะ + เพื่อเพิ่ม'}</p>
      )}

      <div className="kd-segment" role="radiogroup" aria-label="วิธีนับแคลจากการออกกำลังกาย" style={{ marginTop: 12 }}>
        {([['included', 'รวมใน TDEE แล้ว'], ['add', 'บวกเพิ่มในงบ']] as const).map(([mode, text]) => (
          <button key={mode} role="radio" aria-checked={exerciseMode === mode} className={`kd-chip${exerciseMode === mode ? ' on' : ''}`} onClick={() => setExerciseMode(mode)}>
            {text}
          </button>
        ))}
      </div>
      <p className="kd-caption kd-muted" style={{ marginTop: 6 }}>
        {exerciseMode === 'included'
          ? 'เป้าจากระดับกิจกรรมนับการออกกำลังกายไว้แล้ว จึงไม่บวกซ้ำ เลือกแบบนี้ถ้าตั้งระดับกิจกรรมตามจริง'
          : 'แคลที่เผาจะบวกเข้างบวันนั้น เหมาะถ้าตั้งระดับกิจกรรมเป็น "นั่งทำงานเป็นหลัก"'}
      </p>

      {open && (
        <Sheet onClose={() => setOpen(false)} labelledBy="exercise-title">
          <div style={{ padding: '4px 20px 24px', display: 'grid', gap: 12 }}>
            <h2 id="exercise-title" className="kd-h2">บันทึกการออกกำลังกาย</h2>
            <div className="kd-row" style={{ gap: 6, flexWrap: 'wrap' }}>
              {[...EXERCISE_PRESETS.map((p) => ({ id: p.id as string, label: p.label, icon: p.icon as string })), { id: 'other', label: 'อื่น ๆ', icon: 'ph ph-pencil-simple' }].map((p) => (
                <button key={p.id} className={`kd-chip${preset === p.id ? ' on' : ''}`} aria-pressed={preset === p.id} onClick={() => { setPreset(p.id); setKcalDraft('') }}>
                  <Icon name={p.icon} size={16} /> {p.label}
                </button>
              ))}
            </div>
            {preset === 'other' && (
              <input className="kd-input" placeholder="ชื่อกิจกรรม เช่น ทำสวน" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} aria-label="ชื่อกิจกรรม" />
            )}
            <label className="kd-caption">ระยะเวลา (นาที)
              <input className="kd-input" type="number" inputMode="numeric" min={1} max={1440} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
            </label>
            <label className="kd-caption">แคลที่เผา (kcal)
              <input className="kd-input" type="number" inputMode="numeric" min={0} max={5000} placeholder={chosen ? String(estimate) : 'กรอกจากนาฬิกาหรือแอปออกกำลังกาย'} value={kcalDraft} onChange={(e) => setKcalDraft(e.target.value)} />
            </label>
            {chosen && !kcalDraft && (
              <p className="kd-caption kd-muted">ประมาณจากค่า MET {chosen.met} × น้ำหนัก {num(weight)} กก. × เวลา ถ้ามีตัวเลขจากนาฬิกาให้กรอกแทนได้</p>
            )}
            <button className="kd-btn kd-btn-primary" disabled={!valid} onClick={save}>บันทึก {Number.isFinite(kcal) ? num(kcal) : 0} kcal</button>
          </div>
        </Sheet>
      )}
    </section>
  )
}
