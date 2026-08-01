import { useState } from 'react'
import { Icon } from '../components/ui'
import { num } from '../lib/calc'
import { dayKey, useStore } from '../lib/store'

/** หน้า 21 ประวัติ — ระดับ wireframe ตามลำดับความสำคัญ P1 */
export function History() {
  const { entries, profile } = useStore()
  const [range, setRange] = useState(7)
  const target = profile?.target ?? 1850

  const days = Array.from({ length: range }, (_, i) => dayKey(-(range - 1 - i)))
  const totals = days.map((d) => entries.filter((e) => e.day === d).reduce((s, e) => s + e.kcal, 0))
  const logged = totals.filter((t) => t > 0).length
  const avg = logged ? Math.round(totals.reduce((a, b) => a + b, 0) / logged) : 0
  const max = Math.max(target, ...totals) * 1.1

  return (
    <div className="kd-screen">
      <div style={{ paddingTop: 'var(--safe-top)', padding: '47px 16px 0' }}>
        <h1 className="kd-h1">ประวัติ</h1>
        <div className="kd-hscroll" style={{ marginTop: 10 }}>
          {[7, 30, 90].map((r) => (
            <button key={r} className={`kd-chip${range === r ? ' on' : ''}`} aria-pressed={range === r} onClick={() => setRange(r)}>
              {r} วัน
            </button>
          ))}
        </div>
      </div>

      <div className="kd-scroll" style={{ padding: '16px 16px 140px' }}>
        {logged < 3 ? (
          <div className="kd-card" style={{ padding: 20, textAlign: 'center', display: 'grid', gap: 8, justifyItems: 'center' }}>
            <Icon name="ph ph-chart-bar" size={32} color="var(--decor)" />
            <h2 className="kd-h2">กราฟจะเริ่มมีความหมายเมื่อบันทึกครบสัปดาห์</h2>
            <p className="kd-body kd-muted">ตอนนี้บันทึกไป {logged} วันแล้ว บันทึกต่ออีกนิดเดียว</p>
          </div>
        ) : (
          <div className="kd-card" style={{ padding: 16 }}>
            <div style={{ position: 'relative', height: 160, display: 'flex', alignItems: 'flex-end', gap: 3 }}>
              <div
                style={{
                  position: 'absolute', left: 0, right: 0, bottom: `${(target / max) * 100}%`,
                  borderTop: '1px dashed var(--accent-line)',
                }}
                aria-hidden="true"
              />
              {totals.map((t, i) => (
                <div
                  key={i}
                  title={`${days[i]} · ${num(t)} kcal`}
                  style={{
                    flex: 1,
                    height: `${(t / max) * 100}%`,
                    minHeight: 2,
                    borderRadius: '4px 4px 0 0',
                    background: t > target ? 'var(--status-over)' : 'var(--status-mid)',
                  }}
                />
              ))}
            </div>
            <p className="kd-caption kd-muted" style={{ marginTop: 8 }}>เส้นประ = เป้าหมาย {num(target)} kcal</p>
          </div>
        )}

        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr', marginTop: 14 }}>
          <div className="kd-card" style={{ padding: 14 }}>
            <div className="kd-caption kd-muted">เฉลี่ยต่อวัน</div>
            <div className="tnum" style={{ fontSize: 22, fontWeight: 500 }}>{num(avg)}</div>
          </div>
          <div className="kd-card" style={{ padding: 14 }}>
            <div className="kd-caption kd-muted">บันทึกไป</div>
            <div className="tnum" style={{ fontSize: 22, fontWeight: 500 }}>{logged} จาก {range} วัน</div>
          </div>
        </div>

        <div className="kd-card" style={{ padding: 14, marginTop: 10, display: 'flex', gap: 12 }}>
          <Icon name="ph ph-sparkle" size={22} color="var(--accent-pressed)" />
          <div>
            <div className="kd-body" style={{ fontWeight: 500 }}>บันทึกไป {logged} จาก {range} วัน</div>
            <p className="kd-caption kd-muted">
              ความสม่ำเสมอสำคัญกว่าจำนวนวันติดต่อกัน พลาดวันสองวันไม่เป็นไร มี freeze ให้เดือนละ 2 ครั้ง
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
