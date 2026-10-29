import { useState } from 'react'
import type { Entry, Profile } from '../lib/types'
import { totalMacros, num } from '../lib/calc'
import { missingNutrients, nutrientTargets, nutrientStatus, nutrientExplanation, nutrientSources } from '../lib/nutrients'

export function NutrientCard({ profile, entries, historical = false }: { profile: Profile; entries: Entry[]; historical?: boolean }) {
  const [muscle, setMuscle] = useState(profile.goal === 'gain')
  const targets = nutrientTargets(profile, muscle)
  const macros = totalMacros(entries)
  const missing = missingNutrients(entries)
  return <section className="kd-card" style={{ padding: 16, marginTop: 16 }} aria-label="สารอาหารรายวัน">
    <h2 style={{ fontSize: 16, margin: '0 0 10px' }}>สารอาหารรายวัน</h2>
    <div className="kd-row" style={{ gap: 8, flexWrap: 'wrap' }}>
      {[false, true].map(mode => <button key={String(mode)} className="kd-chip" aria-pressed={muscle === mode} onClick={() => setMuscle(mode)} style={{ background: muscle === mode ? 'var(--accent-tint)' : undefined }}>{mode ? 'ดูแลกล้ามเนื้อ' : 'ทั่วไป'}</button>)}
    </div>
    <p className="kd-caption kd-muted">อิงน้ำหนัก {num(profile.weight)} กก. และเป้าพลังงาน {num(profile.target)} kcal{historical ? ' ปัจจุบัน (ไม่ได้บันทึกเป้าในอดีต)' : ''}</p>
    {muscle && <p className="kd-caption">ผู้ใหญ่ที่ออกกำลังกาย: โปรตีนประมาณ {num(profile.weight * 1.4)}–{num(profile.weight * 2)} ก./วัน (1.4–2.0 ก./กก.) แผนนี้ใช้ 1.6 ก./กก.</p>}
    {targets ? (['protein', 'carb', 'fat'] as const).map((key, i) => <div key={key} style={{ marginTop: 12 }}>
      <div className="kd-row" style={{ justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}><span>{['โปรตีน', 'คาร์บ', 'ไขมัน'][i]}</span><span className="tnum">{num(macros[key])} / {num(targets[key])} ก.</span></div>
      <progress aria-label={['โปรตีน', 'คาร์บ', 'ไขมัน'][i]} value={Math.min(macros[key], targets[key])} max={targets[key] || 1} style={{ width: '100%', accentColor: 'var(--status-near)' }} />
      <div className="kd-caption kd-muted">{nutrientStatus(macros[key], targets[key], key === 'protein')}</div>
    </div>) : <p className="kd-caption">น้ำหนักกับงบพลังงานนี้ยังจัดสัดส่วนแผนไม่ได้ ลองตรวจข้อมูลและเป้าแคลอรีในหน้าโปรไฟล์ หรือปรึกษานักกำหนดอาหาร</p>}
    {missing > 0 && <p className="kd-caption">มี {missing} รายการที่ข้อมูลสารอาหารไม่ครบ ยอดที่แสดงอาจต่ำกว่าที่กินจริง</p>}
    <details style={{ marginTop: 12 }}><summary className="kd-caption">วิธีคำนวณและแหล่งอ้างอิง</summary><p className="kd-caption kd-muted">ทั่วไปใช้โปรตีนอย่างน้อย 0.8 ก./กก. และอย่างน้อย 10% ของพลังงาน ไขมัน 30% ของพลังงาน ส่วนที่เหลือเป็นคาร์บ {nutrientExplanation}</p>{nutrientSources.map(s => <p key={s.url} className="kd-caption"><a href={s.url} target="_blank" rel="noreferrer">{s.label}</a></p>)}</details>
  </section>
}
