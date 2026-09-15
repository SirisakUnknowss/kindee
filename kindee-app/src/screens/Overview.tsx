import { Icon } from '../components/ui'
import { MEALS, num, ringTone, totalMacros } from '../lib/calc'
import { dayKey, useStore } from '../lib/store'

export function Overview({ onOpenHealth, onAdd }: { onOpenHealth: () => void; onAdd: () => void }) {
  const { entries, entriesFor, profile } = useStore()
  const target = profile?.target ?? 1850
  const todayEntries = entriesFor(dayKey())
  const consumed = todayEntries.reduce((sum, entry) => sum + entry.kcal, 0)
  const remaining = Math.max(0, target - consumed)
  const percent = target > 0 ? Math.round((consumed / target) * 100) : 0
  const tone = ringTone(consumed, target)
  const macros = totalMacros(todayEntries)
  const radius = 58
  const circumference = 2 * Math.PI * radius
  const week = Array.from({ length: 7 }, (_, index) => {
    const key = dayKey(index - 6)
    return entries.filter((entry) => entry.day === key).reduce((sum, entry) => sum + entry.kcal, 0)
  })
  const weekMax = Math.max(target, ...week)
  const loggedDays = week.filter((total) => total > 0).length

  return (
    <div className="kd-screen">
      <header className="kd-overview-head">
        <div><p className="kd-caption kd-muted">วันนี้</p><h1 className="kd-h1">Overview</h1></div>
        <button className="kd-icon-btn" onClick={onOpenHealth} aria-label="เปิดข้อมูลสุขภาพ"><Icon name="ph ph-heartbeat" size={25} /></button>
      </header>

      <div className="kd-scroll kd-overview-scroll">
        <section className="kd-card kd-overview-hero">
          <div className={`kd-overview-donut is-${tone}`}>
            <svg viewBox="0 0 140 140" aria-hidden="true">
              <circle cx="70" cy="70" r={radius} fill="none" stroke="var(--border)" strokeWidth="13" />
              {consumed > 0 && <circle cx="70" cy="70" r={radius} fill="none" stroke="currentColor" strokeWidth="13" strokeLinecap="round" strokeDasharray={`${circumference * Math.min(1, consumed / target)} ${circumference}`} transform="rotate(-90 70 70)" />}
            </svg>
            <div><strong className="tnum">{percent}%</strong><span>ของเป้า</span></div>
          </div>
          <div className="kd-overview-hero-copy">
            <span>พลังงานวันนี้</span>
            <strong className="tnum">{num(consumed)} <small>kcal</small></strong>
            <p>{consumed > target ? `เกินเป้า ${num(consumed - target)} kcal` : `เหลืออีก ${num(remaining)} kcal`}</p>
            <button onClick={onOpenHealth}>ดูรายละเอียด <Icon name="ph ph-arrow-right" size={15} /></button>
          </div>
        </section>

        <div className="kd-overview-metrics">
          <div><Icon name="ph ph-flag" /><span>เป้าต่อวัน</span><strong className="tnum">{num(target)}</strong></div>
          <div><Icon name="ph ph-fork-knife" /><span>กินไป</span><strong className="tnum">{num(consumed)}</strong></div>
          <div><Icon name="ph ph-wallet" /><span>คงเหลือ</span><strong className="tnum">{num(remaining)}</strong></div>
        </div>

        <section className="kd-card kd-overview-week">
          <div className="kd-section-title"><div><h2 className="kd-h2">7 วันที่ผ่านมา</h2><p className="kd-caption kd-muted">บันทึกแล้ว {loggedDays} วัน</p></div><Icon name="ph ph-chart-bar" size={22} color="var(--accent-pressed)" /></div>
          <div className="kd-overview-bars">
            {week.map((total, index) => <div key={index}><i style={{ height: `${Math.max(4, (total / weekMax) * 100)}%` }} className={total > target ? 'over' : ''} /><span>{['พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.', 'จ.', 'อ.'][index]}</span></div>)}
          </div>
        </section>

        <section className="kd-card kd-overview-meals">
          <div className="kd-section-title"><div><h2 className="kd-h2">มื้อวันนี้</h2><p className="kd-caption kd-muted">{todayEntries.length} รายการ</p></div><button onClick={onAdd}>เพิ่มอาหาร</button></div>
          <div className="kd-overview-meal-grid">
            {MEALS.map((meal) => {
              const total = todayEntries.filter((entry) => entry.meal === meal.id).reduce((sum, entry) => sum + entry.kcal, 0)
              return <button key={meal.id} onClick={onOpenHealth}><Icon name={meal.icon} size={19} /><span>{meal.label}</span><strong className="tnum">{num(total)}</strong></button>
            })}
          </div>
        </section>

        {todayEntries.length > 0 && <div className="kd-overview-macros"><span>โปรตีน <strong>{num(macros.protein)} ก.</strong></span><span>คาร์บ <strong>{num(macros.carb)} ก.</strong></span><span>ไขมัน <strong>{num(macros.fat)} ก.</strong></span></div>}
      </div>
    </div>
  )
}
