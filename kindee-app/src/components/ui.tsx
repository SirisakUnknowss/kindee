import type { CSSProperties, ReactNode } from 'react'
import { QUALITY, type Food, type Quality } from '../data/foods'
import { num, ringColor, type RingTone } from '../lib/calc'

export function Icon({ name, size = 20, color, style }: { name: string; size?: number; color?: string; style?: CSSProperties }) {
  return <i className={name} aria-hidden="true" style={{ fontSize: size, color, lineHeight: 1, ...style }} />
}

/** ป้ายคุณภาพข้อมูล — ไอคอน + ข้อความเสมอ ห้ามสื่อด้วยสีอย่างเดียว */
export function QualityBadge({ q }: { q: Quality }) {
  const meta = QUALITY[q]
  return (
    <span className="kd-quality" style={{ color: meta.color }}>
      <Icon name={meta.icon} size={13} />
      {meta.label}
    </span>
  )
}

export function Thumb({ food, size = 44 }: { food: Food; size?: number }) {
  const packaged = food.kind === 'pack'
  return (
    <div
      style={{
        width: size,
        height: size,
        flex: 'none',
        borderRadius: 12,
        display: 'grid',
        placeItems: 'center',
        background: packaged ? 'var(--accent-tint)' : '#e9efe9',
        color: packaged ? 'var(--accent-pressed)' : '#4f6b55',
      }}
    >
      <Icon name={food.icon} size={size * 0.48} />
    </div>
  )
}

export function Sheet({
  children,
  onClose,
  labelledBy,
}: {
  children: ReactNode
  onClose: () => void
  labelledBy?: string
}) {
  return (
    <>
      <div className="kd-backdrop" onClick={onClose} role="presentation" />
      <div className="kd-sheet kd-anim-sheet" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
        <div className="kd-handle" />
        {children}
      </div>
    </>
  )
}

export function Header({
  title,
  onBack,
  right,
}: {
  title?: string
  onBack?: () => void
  right?: ReactNode
}) {
  return (
    <div className="kd-row" style={{ gap: 8, padding: '4px 8px', minHeight: 52 }}>
      {onBack && (
        <button className="kd-icon-btn" onClick={onBack} aria-label="ย้อนกลับ">
          <Icon name="ph ph-caret-left" size={22} />
        </button>
      )}
      {title && <div className="kd-h2" style={{ flex: 1, paddingLeft: onBack ? 0 : 8 }}>{title}</div>}
      {!title && <div style={{ flex: 1 }} />}
      {right}
    </div>
  )
}

/** วงแหวนความคืบหน้าแคลอรี — โทนต่อเนื่อง ไม่มีแดง */
export function CalorieRing({
  consumed,
  target,
  tone,
  loading,
}: {
  consumed: number
  target: number
  tone: RingTone
  loading?: boolean
}) {
  const r = 86
  const c = 2 * Math.PI * r
  const pct = target > 0 ? Math.min(1, consumed / target) : 0
  const over = consumed > target
  const left = Math.abs(target - consumed)

  return (
    <div style={{ position: 'relative', width: 200, height: 200, margin: '0 auto' }}>
      <svg width="200" height="200" viewBox="0 0 200 200" aria-hidden="true">
        <circle cx="100" cy="100" r={r} fill="none" stroke="var(--border)" strokeWidth="13" />
        {!loading && pct > 0 && (
          <circle
            cx="100"
            cy="100"
            r={r}
            fill="none"
            stroke={ringColor(tone)}
            strokeWidth="13"
            strokeLinecap="round"
            strokeDasharray={`${c * pct} ${c}`}
            transform="rotate(-90 100 100)"
            style={{ transition: 'stroke-dasharray .45s cubic-bezier(.22,.61,.36,1)' }}
          />
        )}
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
        }}
      >
        {loading ? (
          <>
            <div className="kd-skel" style={{ width: 56, height: 12 }} />
            <div className="kd-skel" style={{ width: 96, height: 34, marginTop: 8 }} />
          </>
        ) : (
          <>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{over ? 'เกินมา' : 'เหลืออีก'}</div>
            <div className="kd-display tnum">{num(left)}</div>
            <div className="kd-body kd-muted tnum">จาก {num(target)}</div>
          </>
        )}
      </div>
    </div>
  )
}

export function MacroBar({
  macros,
}: {
  macros: { protein: number; carb: number; fat: number }
}) {
  const rows = [
    { label: 'โปรตีน', v: macros.protein, color: 'var(--status-near)', max: 120 },
    { label: 'คาร์บ', v: macros.carb, color: 'var(--accent-line)', max: 260 },
    { label: 'ไขมัน', v: macros.fat, color: 'var(--status-over)', max: 70 },
  ]
  return (
    <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
      {rows.map((r) => (
        <div key={r.label} style={{ flex: 1 }}>
          <div className="kd-row" style={{ justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.label}</span>
            <span className="kd-caption tnum">{num(r.v)} ก.</span>
          </div>
          <div style={{ height: 4, borderRadius: 999, background: 'var(--border)', marginTop: 4 }}>
            <div
              style={{
                height: 4,
                borderRadius: 999,
                width: `${Math.min(100, (r.v / r.max) * 100)}%`,
                background: r.color,
                transition: 'width .35s ease',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

export function OfflineBar({ text }: { text: string }) {
  return (
    <div className="kd-offline" role="status">
      <Icon name="ph ph-wifi-slash" size={15} />
      <span>{text}</span>
    </div>
  )
}

export function Mascot({ size = 96 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" aria-hidden="true">
      <path
        d="M16 44h64a4 4 0 0 1 4 4 32 32 0 0 1-32 32H44A32 32 0 0 1 12 48a4 4 0 0 1 4-4Z"
        fill="var(--accent-tint)"
        stroke="var(--accent-line)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <circle cx="38" cy="58" r="3" fill="var(--accent-pressed)" />
      <circle cx="58" cy="58" r="3" fill="var(--accent-pressed)" />
      <path d="M40 66q8 6 16 0" fill="none" stroke="var(--accent-pressed)" strokeWidth="3" strokeLinecap="round" />
      <path d="M36 34c-5-6 5-9 0-16M48 34c-5-6 5-9 0-16M60 34c-5-6 5-9 0-16" fill="none" stroke="var(--decor)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
