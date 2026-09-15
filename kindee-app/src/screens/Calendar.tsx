import { useMemo, useState } from 'react'
import { Icon } from '../components/ui'
import { num } from '../lib/calc'
import { dayKey, useStore } from '../lib/store'

type DayStatus = 'success' | 'under' | 'over' | 'empty'
const MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
const statusLabel: Record<DayStatus, string> = { success: 'สำเร็จ', under: 'ยังไม่ถึงเป้า', over: 'เกินเป้า', empty: 'ไม่ได้บันทึก' }

function fromKey(key: string) {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}
function toKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
function statusFor(total: number, target: number): DayStatus {
  if (total <= 0) return 'empty'
  if (total > target) return 'over'
  return total >= target * .85 ? 'success' : 'under'
}
function CalendarRing({ total, target, date }: { total: number; target: number; date: Date }) {
  const status = statusFor(total, target)
  const circumference = 2 * Math.PI * 16
  const percent = target > 0 ? Math.min(1, total / target) : 0
  return (
    <svg className={`kd-mini-ring is-${status}`} width="41" height="41" viewBox="0 0 42 42" role="img" aria-label={`${date.getDate()} ${MONTHS[date.getMonth()]} ${statusLabel[status]}`}>
      <circle cx="21" cy="21" r="16" fill="none" stroke="var(--border)" strokeWidth="5" />
      {total > 0 && <circle cx="21" cy="21" r="16" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${circumference * percent} ${circumference}`} transform="rotate(-90 21 21)" />}
      {status === 'success' && <path d="m15.5 21 3.7 3.8 7.5-8" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  )
}

export function Calendar({ onOpenDay }: { onOpenDay: (day: string) => void }) {
  const { entries, profile } = useStore()
  const [month, setMonth] = useState(() => fromKey(dayKey()))
  const today = fromKey(dayKey())
  const target = profile?.target ?? 1850
  const totals = useMemo(() => {
    const map = new Map<string, number>()
    for (const entry of entries) map.set(entry.day, (map.get(entry.day) ?? 0) + entry.kcal)
    return map
  }, [entries])
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const offset = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7
  const dates = Array.from({ length: count }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index + 1))
  const pastDates = dates.filter((date) => date <= today)
  const logged = pastDates.filter((date) => (totals.get(toKey(date)) ?? 0) > 0)
  const successes = logged.filter((date) => statusFor(totals.get(toKey(date)) ?? 0, target) === 'success').length
  const average = logged.length ? Math.round(logged.reduce((sum, date) => sum + (totals.get(toKey(date)) ?? 0), 0) / logged.length) : 0
  const currentMonth = month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth()
  const moveMonth = (amount: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + amount, 1))

  return (
    <div className="kd-screen">
      <header className="kd-calendar-screen-head"><div><p className="kd-caption kd-muted">ประวัติรายวัน</p><h1 className="kd-h1">Calendar</h1></div><Icon name="ph ph-calendar-dots" size={27} color="var(--accent-pressed)" /></header>
      <div className="kd-scroll kd-calendar-screen-scroll">
        <div className="kd-period-nav">
          <button className="kd-icon-btn" onClick={() => moveMonth(-1)} aria-label="เดือนก่อนหน้า"><Icon name="ph ph-caret-left" /></button>
          <div><strong>{MONTHS[month.getMonth()]} {month.getFullYear() + 543}</strong><span>แตะวันที่เพื่อเปิดข้อมูล Health</span></div>
          <button className="kd-icon-btn" onClick={() => moveMonth(1)} disabled={currentMonth} aria-label="เดือนถัดไป"><Icon name="ph ph-caret-right" /></button>
        </div>
        <div className="kd-card kd-month-card">
          <div className="kd-calendar-head">{['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.'].map((day) => <span key={day}>{day}</span>)}</div>
          <div className="kd-calendar-grid">
            {Array.from({ length: offset }, (_, index) => <span key={`blank-${index}`} />)}
            {dates.map((date) => {
              const total = totals.get(toKey(date)) ?? 0
              return <button key={toKey(date)} disabled={date > today} className={toKey(date) === dayKey() ? 'today' : ''} onClick={() => onOpenDay(toKey(date))}><span>{date.getDate()}</span><CalendarRing total={total} target={target} date={date} /></button>
            })}
          </div>
        </div>
        <div className="kd-analyze-stats">
          <div><strong className="tnum">{successes}</strong><span>วันสำเร็จ</span></div>
          <div><strong className="tnum">{logged.length}</strong><span>วันที่บันทึก</span></div>
          <div><strong className="tnum">{num(average)}</strong><span>เฉลี่ย kcal</span></div>
        </div>
        <div className="kd-status-legend">
          {(['success', 'under', 'over', 'empty'] as DayStatus[]).map((status) => <span key={status} className={`is-${status}`}><i />{statusLabel[status]}</span>)}
        </div>
      </div>
    </div>
  )
}
