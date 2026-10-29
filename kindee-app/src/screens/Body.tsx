import { useMemo, useState } from 'react'
import { Header, Icon, Sheet } from '../components/ui'
import {
  MEASURES, PERIODS, aggregate, applyToProfile, latestValues, measureMeta, parseMeasurementInput, shortDay, signed, toUnit, unitLabel,
  type BodyMeasurement, type BodyValues, type LengthUnit, type MeasureKey, type Period,
} from '../lib/body'
import { ageFrom, num } from '../lib/calc'
import { dayKey, useStore } from '../lib/store'
import type { Profile } from '../lib/types'

type Draft = { day: string; fields: Partial<Record<MeasureKey, string>>; prefilled: BodyValues; editing: boolean }

/** กราฟเส้นเล็ก ๆ ของค่าเดียว — ช่วงละหนึ่งจุด */
function TrendChart({ points, unit }: { points: { label: string; value: number }[]; unit: string }) {
  if (points.length < 2) {
    return <p className="kd-caption kd-muted kd-body-chart-empty">บันทึกอย่างน้อย 2 ช่วงเพื่อดูกราฟแนวโน้ม</p>
  }
  const w = 320
  const h = 150
  const pad = { l: 8, r: 8, t: 22, b: 24 }
  const values = points.map((p) => p.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const x = (i: number) => pad.l + (i * (w - pad.l - pad.r)) / (points.length - 1)
  const y = (v: number) => pad.t + (1 - (v - min) / span) * (h - pad.t - pad.b)
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const labelEvery = Math.ceil(points.length / 6)
  return (
    <svg className="kd-body-chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`กราฟแนวโน้ม ${points.map((p) => `${p.label} ${p.value} ${unit}`).join(', ')}`}>
      <line x1={pad.l} x2={w - pad.r} y1={h - pad.b} y2={h - pad.b} stroke="var(--border)" />
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <g key={p.label}>
          <circle cx={x(i)} cy={y(p.value)} r="4" fill="var(--surface)" stroke="var(--accent)" strokeWidth="2" />
          {(i === points.length - 1 || i % labelEvery === 0) && (
            <>
              <text x={x(i)} y={y(p.value) - 9} textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'} className="kd-body-chart-value">{p.value}</text>
              <text x={x(i)} y={h - 7} textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'} className="kd-body-chart-label">{p.label}</text>
            </>
          )}
        </g>
      ))}
    </svg>
  )
}

const Change = ({ value }: { value?: number }) =>
  value == null ? <span className="kd-muted">—</span> : <span className="tnum kd-body-change">{signed(value)}</span>

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
  const previousLabel = PERIODS.find((p) => p.id === period)!.previous
  const age = profile ? ageFrom(profile.bDay, profile.bMonth, profile.bYear) : null

  const openForm = (m?: BodyMeasurement) => {
    const source = m ?? { ...latestValues(measurements), weight: latest.weight ?? profile?.weight, height: latest.height ?? profile?.height }
    const fields: Draft['fields'] = {}
    const prefilled: BodyValues = {}
    for (const { key } of MEASURES) {
      if (source[key] == null) continue
      prefilled[key] = source[key]
      fields[key] = String(show(key, source[key]!))
    }
    setDraft({ day: m?.day ?? dayKey(), fields, prefilled, editing: Boolean(m) })
    setApplyProfile(true)
    setError('')
  }

  const isNewest = draft ? !lastDay || draft.day >= lastDay : false

  const save = () => {
    if (!draft) return
    if (!draft.day || draft.day > dayKey()) return setError('เลือกวันที่ไม่เกินวันนี้')
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
    <div className="kd-screen">
      <div className="kd-safe-top" />
      <Header title="ติดตามรูปร่าง" onBack={onBack} right={
        <button className="kd-icon-btn" onClick={() => openForm()} aria-label="บันทึกค่าวัด"><Icon name="ph ph-plus" size={22} /></button>
      } />
      <div className="kd-scroll kd-body-scroll">
        <section className="kd-card kd-body-summary">
          {[
            ['อายุ', age != null ? `${age} ปี` : '—'],
            ['ส่วนสูง', (latest.height ?? profile?.height) != null ? `${show('height', (latest.height ?? profile?.height)!)} ${unit('height')}` : '—'],
            ['น้ำหนัก', `${latest.weight ?? profile?.weight ?? '—'} กก.`],
          ].map(([label, value]) => (
            <div key={label}><span className="kd-caption kd-muted">{label}</span><strong className="tnum">{value}</strong></div>
          ))}
        </section>
        <div className="kd-body-note">
          <p className="kd-caption kd-muted">อายุคำนวณจากวันเกิดในโปรไฟล์ · แก้ได้ที่ ฉัน → เป้าหมาย</p>
          <div className="kd-body-units" role="radiogroup" aria-label="หน่วยความยาว">
            {([['cm', 'ซม.'], ['in', 'นิ้ว']] as [LengthUnit, string][]).map(([id, label]) => (
              <button key={id} role="radio" aria-checked={lengthUnit === id} className={lengthUnit === id ? 'on' : ''} onClick={() => setLengthUnit(id)}>{label}</button>
            ))}
          </div>
        </div>

        <button className="kd-btn kd-btn-primary" onClick={() => openForm()}>
          <Icon name="ph ph-ruler" size={20} /> บันทึกค่าวัดวันนี้
        </button>

        {measurements.length === 0 ? (
          <section className="kd-card kd-body-empty">
            <Icon name="ph ph-person-simple" size={34} color="var(--accent-pressed)" />
            <p className="kd-body">ยังไม่มีค่าวัด</p>
            <p className="kd-caption kd-muted">วัดตอนเช้าก่อนกินอาหาร ใช้สายวัดเส้นเดิมและวัดตำแหน่งเดิมทุกครั้ง จะเห็นแนวโน้มชัดกว่า</p>
          </section>
        ) : (
          <>
            <div className="kd-view-switch kd-body-switch" role="tablist" aria-label="ช่วงเวลา">
              {PERIODS.map((p) => (
                <button key={p.id} role="tab" aria-selected={period === p.id} className={period === p.id ? 'on' : ''} onClick={() => setPeriod(p.id)}>{p.label}</button>
              ))}
            </div>

            {current && (
              <section className="kd-card kd-body-compare">
                <div className="kd-section-title">
                  <div><h2 className="kd-h2">{current.label}</h2><p className="kd-caption kd-muted">{period === 'day' ? 'ค่าที่วัด' : `ค่าเฉลี่ยจาก ${current.count} วัน`} · เทียบ{previousLabel}ที่มีการวัด</p></div>
                </div>
                <div className="kd-body-grid">
                  {MEASURES.filter((m) => current.values[m.key] != null).map((m) => (
                    <button key={m.key} className={metric === m.key ? 'on' : ''} onClick={() => setMetric(m.key)} aria-pressed={metric === m.key}>
                      <span>{m.label}</span>
                      <strong className="tnum">{show(m.key, current.values[m.key]!)} <small>{unit(m.key)}</small></strong>
                      <Change value={current.change[m.key] == null ? undefined : show(m.key, current.change[m.key]!)} />
                    </button>
                  ))}
                </div>
              </section>
            )}

            <section className="kd-card kd-body-trend">
              <div className="kd-hscroll kd-body-chips">
                {MEASURES.map((m) => (
                  <button key={m.key} className={`kd-chip${metric === m.key ? ' on' : ''}`} aria-pressed={metric === m.key} onClick={() => setMetric(m.key)}>{m.label}</button>
                ))}
              </div>
              <TrendChart points={chartPoints} unit={unit(metric)} />
              {metricRows.length > 0 ? (
                <table className="kd-body-table">
                  <thead><tr><th>{PERIODS.find((p) => p.id === period)!.label.replace('ราย', '')}</th><th>{meta.label} ({unit(metric)})</th><th>เปลี่ยนแปลง</th></tr></thead>
                  <tbody>
                    {[...metricRows].reverse().map((r) => (
                      <tr key={r.start}><td>{r.label}</td><td className="tnum">{show(metric, r.values[metric]!)}</td><td><Change value={r.change[metric] == null ? undefined : show(metric, r.change[metric]!)} /></td></tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="kd-caption kd-muted">ยังไม่ได้วัด{meta.label}</p>
              )}
            </section>

            <section className="kd-card kd-body-history">
              <h2 className="kd-h2">ประวัติการวัด</h2>
              {[...measurements].reverse().map((m) => (
                <div key={m.day} className="kd-body-history-row">
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <strong>{shortDay(m.day)}{m.pending && <span className="kd-caption kd-muted"> · รอซิงก์</span>}</strong>
                    <p className="kd-caption kd-muted tnum">{MEASURES.filter((x) => m[x.key] != null).map((x) => `${x.label} ${show(x.key, m[x.key]!)} ${unit(x.key)}`).join(' · ')}</p>
                  </div>
                  {confirmDelete === m.day ? (
                    <>
                      <button className="kd-btn-text" onClick={() => setConfirmDelete(null)}>ยกเลิก</button>
                      <button className="kd-btn-text kd-body-delete" onClick={() => { removeMeasurement(m.day); setConfirmDelete(null); showToast('ลบค่าวัดแล้ว') }}>ยืนยันลบ</button>
                    </>
                  ) : (
                    <>
                      <button className="kd-icon-btn" onClick={() => openForm(m)} aria-label={`แก้ไขค่าวัด ${shortDay(m.day)}`}><Icon name="ph ph-pencil-simple" size={19} /></button>
                      <button className="kd-icon-btn" onClick={() => setConfirmDelete(m.day)} aria-label={`ลบค่าวัด ${shortDay(m.day)}`}><Icon name="ph ph-trash" size={19} /></button>
                    </>
                  )}
                </div>
              ))}
            </section>
          </>
        )}
      </div>

      {draft && (
        <Sheet onClose={() => setDraft(null)} labelledBy="body-form-title">
          <div className="kd-body-form">
            <h2 className="kd-h2" id="body-form-title">{draft.editing ? 'แก้ไขค่าวัด' : 'บันทึกค่าวัด'}</h2>
            <label>
              <span className="kd-field-label">วันที่วัด</span>
              <input className="kd-input" type="date" value={draft.day} max={dayKey()} disabled={draft.editing}
                onChange={(e) => setDraft({ ...draft, day: e.target.value })} />
            </label>
            <div className="kd-body-form-grid">
              {MEASURES.map((m) => (
                <label key={m.key}>
                  <span className="kd-field-label">{m.label}</span>
                  <div className="kd-input-with-unit">
                    <input className="kd-input tnum" type="number" inputMode="decimal" step="0.1" placeholder="–"
                      value={draft.fields[m.key] ?? ''}
                      onChange={(e) => { setDraft({ ...draft, fields: { ...draft.fields, [m.key]: e.target.value } }); setError('') }} />
                    <span>{unit(m.key)}</span>
                  </div>
                </label>
              ))}
            </div>
            <p className="kd-caption kd-muted">เว้นว่างช่องที่ไม่ได้วัดได้ บันทึกวันเดิมซ้ำจะแทนที่ค่าเดิม</p>
            {profile && isNewest && (
              <label className="kd-row kd-body-apply">
                <input type="checkbox" checked={applyProfile} onChange={(e) => setApplyProfile(e.target.checked)} />
                <span>
                  ใช้น้ำหนัก/ส่วนสูงนี้ในโปรไฟล์
                  <span className="kd-caption kd-muted" style={{ display: 'block' }}>
                    {profile.targetSource === 'auto' ? 'เป้าแคลอรีจะคำนวณใหม่ตาม TDEE' : 'เป้าที่คุณตั้งเองจะไม่เปลี่ยน'}
                  </span>
                </span>
              </label>
            )}
            {error && <p className="kd-err" role="alert">{error}</p>}
            <button className="kd-btn kd-btn-primary" onClick={save}>บันทึก</button>
          </div>
        </Sheet>
      )}
    </div>
  )
}
