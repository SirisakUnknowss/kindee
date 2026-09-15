import { useMemo, useState } from 'react'
import { Icon } from '../components/ui'
import { num } from '../lib/calc'
import { dayKey, useStore } from '../lib/store'

type View = 'day' | 'week' | 'month'
type DayStatus = 'success' | 'under' | 'over' | 'empty'

const SHORT_DAYS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']
const MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']

function fromKey(key: string) {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function toKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function addDays(date: Date, amount: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

function statusFor(total: number, target: number): DayStatus {
  if (total <= 0) return 'empty'
  if (total > target) return 'over'
  if (total >= target * 0.85) return 'success'
  return 'under'
}

const statusMeta: Record<DayStatus, { label: string; icon: string }> = {
  success: { label: 'สำเร็จ', icon: 'ph-fill ph-check-circle' },
  under: { label: 'ยังไม่ถึงเป้า', icon: 'ph ph-arrow-down' },
  over: { label: 'เกินเป้า', icon: 'ph ph-arrow-up' },
  empty: { label: 'ไม่ได้บันทึก', icon: 'ph ph-minus-circle' },
}

function MiniRing({ total, target, size = 42, label }: { total: number; target: number; size?: number; label?: string }) {
  const status = statusFor(total, target)
  const radius = 16
  const circumference = 2 * Math.PI * radius
  const percent = target > 0 ? Math.min(1, total / target) : 0
  return (
    <svg className={`kd-mini-ring is-${status}`} width={size} height={size} viewBox="0 0 42 42" aria-label={label} role={label ? 'img' : undefined}>
      <circle cx="21" cy="21" r={radius} fill="none" stroke="var(--border)" strokeWidth="5" />
      {total > 0 && (
        <circle cx="21" cy="21" r={radius} fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round"
          strokeDasharray={`${circumference * percent} ${circumference}`} transform="rotate(-90 21 21)" />
      )}
      {status === 'success' && <path d="m15.5 21 3.7 3.8 7.5-8" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  )
}

function RangeSummary({ totals, target }: { totals: number[]; target: number }) {
  const logged = totals.filter((total) => total > 0)
  const successes = totals.filter((total) => statusFor(total, target) === 'success').length
  const average = logged.length ? Math.round(logged.reduce((sum, total) => sum + total, 0) / logged.length) : 0
  return (
    <div className="kd-analyze-stats">
      <div><strong className="tnum">{successes}</strong><span>วันสำเร็จ</span></div>
      <div><strong className="tnum">{logged.length}</strong><span>วันที่บันทึก</span></div>
      <div><strong className="tnum">{num(average)}</strong><span>เฉลี่ย kcal</span></div>
    </div>
  )
}

function DayView({ selected, setSelected, total, target, onOpenDay }: {
  selected: Date
  setSelected: (date: Date) => void
  total: number
  target: number
  onOpenDay?: (day: string) => void
}) {
  const status = statusFor(total, target)
  const meta = statusMeta[status]
  const today = fromKey(dayKey())
  const percent = target > 0 ? Math.round((total / target) * 100) : 0
  return (
    <>
      <div className="kd-date-nav">
        <button className="kd-icon-btn" onClick={() => setSelected(addDays(selected, -1))} aria-label="วันก่อนหน้า"><Icon name="ph ph-caret-left" /></button>
        <div><strong>{toKey(selected) === dayKey() ? 'วันนี้' : `${selected.getDate()} ${MONTHS[selected.getMonth()]}`}</strong><span>{SHORT_DAYS[selected.getDay()]} {selected.getFullYear() + 543}</span></div>
        <button className="kd-icon-btn" onClick={() => setSelected(addDays(selected, 1))} disabled={selected >= today} aria-label="วันถัดไป"><Icon name="ph ph-caret-right" /></button>
      </div>

      <section className={`kd-card kd-day-result is-${status}`}>
        <MiniRing total={total} target={target} size={118} />
        <div className="kd-day-result-copy">
          <span className="kd-status-label"><Icon name={meta.icon} size={18} />{meta.label}</span>
          <strong className="tnum">{num(total)} <small>/ {num(target)} kcal</small></strong>
          <p>{status === 'success' ? `ทำได้ ${percent}% อยู่ในช่วงเป้าหมาย` : status === 'empty' ? 'วันนี้ยังไม่มีรายการอาหาร' : `ทำได้ ${percent}% ของเป้าหมาย`}</p>
        </div>
      </section>

      <div className="kd-card kd-goal-guide">
        <div><span>ช่วงเป้าหมายวันนี้</span><strong className="tnum">{num(target * .85)}–{num(target)} kcal</strong></div>
        <div className="kd-goal-rail"><i style={{ width: `${Math.min(100, percent)}%` }} /></div>
        <p className="kd-caption kd-muted">วันสำเร็จคือวันที่บันทึกได้ 85–100% ของเป้า</p>
      </div>

      {total > 0 && onOpenDay && <button className="kd-btn kd-btn-outline" onClick={() => onOpenDay(toKey(selected))}>ดูรายการอาหารวันนี้ <Icon name="ph ph-arrow-right" size={18} /></button>}
    </>
  )
}

export function History({ onOpenDay }: { onOpenDay?: (day: string) => void }) {
  const { entries, profile } = useStore()
  const [view, setView] = useState<View>('week')
  const [selected, setSelected] = useState(() => fromKey(dayKey()))
  const target = profile?.target ?? 1850

  const totalsByDay = useMemo(() => {
    const totals = new Map<string, number>()
    for (const entry of entries) totals.set(entry.day, (totals.get(entry.day) ?? 0) + entry.kcal)
    return totals
  }, [entries])
  const totalFor = (date: Date) => totalsByDay.get(toKey(date)) ?? 0
  const today = fromKey(dayKey())
  const weekStart = addDays(selected, -((selected.getDay() + 6) % 7))
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
  const monthDays = new Date(selected.getFullYear(), selected.getMonth() + 1, 0).getDate()
  const monthOffset = (new Date(selected.getFullYear(), selected.getMonth(), 1).getDay() + 6) % 7
  const monthDates = Array.from({ length: monthDays }, (_, index) => new Date(selected.getFullYear(), selected.getMonth(), index + 1))
  const visibleDates = view === 'week' ? weekDays.filter((date) => date <= today) : monthDates.filter((date) => date <= today)
  const visibleTotals = visibleDates.map(totalFor)
  const maxTotal = Math.max(target, ...visibleTotals)

  const movePeriod = (amount: number) => {
    const next = new Date(selected)
    if (view === 'month') next.setMonth(next.getMonth() + amount, 1)
    else next.setDate(next.getDate() + amount * 7)
    setSelected(next > today ? today : next)
  }

  return (
    <div className="kd-screen">
      <header className="kd-analyze-head"><div><p className="kd-caption kd-muted">ภาพรวมการกิน</p><h1 className="kd-h1">วิเคราะห์</h1></div><Icon name="ph ph-chart-donut" size={28} color="var(--accent-pressed)" /></header>
      <div className="kd-view-switch" role="tablist" aria-label="ช่วงเวลา">
        {([['day', 'รายวัน'], ['week', 'รายสัปดาห์'], ['month', 'รายเดือน']] as const).map(([id, label]) => <button key={id} role="tab" aria-selected={view === id} className={view === id ? 'on' : ''} onClick={() => setView(id)}>{label}</button>)}
      </div>

      <div className="kd-scroll kd-analyze-scroll">
        {view === 'day' ? <DayView selected={selected} setSelected={setSelected} total={totalFor(selected)} target={target} onOpenDay={onOpenDay} /> : (
          <>
            <div className="kd-period-nav">
              <button className="kd-icon-btn" onClick={() => movePeriod(-1)} aria-label={view === 'week' ? 'สัปดาห์ก่อนหน้า' : 'เดือนก่อนหน้า'}><Icon name="ph ph-caret-left" /></button>
              <div><strong>{view === 'month' ? `${MONTHS[selected.getMonth()]} ${selected.getFullYear() + 543}` : `${weekDays[0].getDate()} ${MONTHS[weekDays[0].getMonth()]} – ${weekDays[6].getDate()} ${MONTHS[weekDays[6].getMonth()]}`}</strong><span>{view === 'week' ? 'สรุป 7 วัน' : 'แตะวันที่เพื่อดูรายละเอียด'}</span></div>
              <button className="kd-icon-btn" onClick={() => movePeriod(1)} disabled={view === 'month' ? selected.getFullYear() === today.getFullYear() && selected.getMonth() === today.getMonth() : weekDays[6] >= today} aria-label={view === 'week' ? 'สัปดาห์ถัดไป' : 'เดือนถัดไป'}><Icon name="ph ph-caret-right" /></button>
            </div>

            {view === 'week' ? (
              <div className="kd-card kd-week-card">
                <div className="kd-week-rings">
                  {weekDays.map((date) => {
                    const total = totalFor(date)
                    return <button key={toKey(date)} disabled={date > today} onClick={() => { setSelected(date); setView('day') }}><span>{SHORT_DAYS[date.getDay()]}</span><MiniRing total={total} target={target} label={`${date.getDate()} ${MONTHS[date.getMonth()]} ${statusMeta[statusFor(total, target)].label}`} /><strong>{date.getDate()}</strong></button>
                  })}
                </div>
                <div className="kd-bar-chart" aria-label="กราฟแคลอรีรายวัน">
                  <i className="kd-target-line" style={{ bottom: `${(target / maxTotal) * 100}%` }}><span>เป้า</span></i>
                  {weekDays.map((date) => {
                    const total = totalFor(date)
                    return <button key={toKey(date)} disabled={date > today} onClick={() => { setSelected(date); setView('day') }} aria-label={`${toKey(date)} ${num(total)} กิโลแคลอรี`}><i className={`is-${statusFor(total, target)}`} style={{ height: `${Math.max(2, (total / maxTotal) * 100)}%` }} /></button>
                  })}
                </div>
              </div>
            ) : (
              <div className="kd-card kd-month-card">
                <div className="kd-calendar-head">{['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.'].map((day) => <span key={day}>{day}</span>)}</div>
                <div className="kd-calendar-grid">
                  {Array.from({ length: monthOffset }, (_, index) => <span key={`blank-${index}`} />)}
                  {monthDates.map((date) => {
                    const total = totalFor(date)
                    return <button key={toKey(date)} disabled={date > today} className={toKey(date) === dayKey() ? 'today' : ''} onClick={() => { setSelected(date); setView('day') }}><span>{date.getDate()}</span><MiniRing total={total} target={target} size={39} label={`${date.getDate()} ${MONTHS[date.getMonth()]} ${statusMeta[statusFor(total, target)].label}`} /></button>
                  })}
                </div>
              </div>
            )}
            <RangeSummary totals={visibleTotals} target={target} />
            <div className="kd-status-legend">{(['success', 'under', 'over', 'empty'] as DayStatus[]).map((status) => <span key={status} className={`is-${status}`}><i />{statusMeta[status].label}</span>)}</div>
          </>
        )}
      </div>
    </div>
  )
}
