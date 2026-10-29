import { useCallback, useEffect, useState } from 'react'
import { Header, Icon } from '../components/ui'
import { joinLeaderboard, leaveLeaderboard, loadMembership, loadMonthlyRanks, validNickname, type RankRow } from '../lib/leaderboard'
import { useStore } from '../lib/store'

const THAI_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']

/** อันดับประจำเดือน — นับจำนวนวันที่บันทึกอาหาร เฉพาะคนที่เลือกเข้าร่วม */
export function Leaderboard({ onBack }: { onBack: () => void }) {
  const { session, setSession, online } = useStore()
  const userId = session?.kind === 'account' ? session.userId : null
  const [nickname, setNickname] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [rows, setRows] = useState<RankRow[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [busy, setBusy] = useState(false)
  const now = new Date()
  const daysSoFar = now.getDate()

  const refresh = useCallback(async () => {
    if (!userId) return
    setState('loading')
    try {
      const [name, ranks] = await Promise.all([loadMembership(userId), loadMonthlyRanks()])
      setNickname(name)
      setDraft(name ?? '')
      setRows(ranks)
      setState('ready')
    } catch {
      setState('error')
    }
  }, [userId])

  useEffect(() => { void refresh() }, [refresh])

  const join = async () => {
    if (!userId || !validNickname(draft)) return
    setBusy(true)
    try {
      await joinLeaderboard(userId, draft)
      await refresh()
    } catch {
      setState('error')
    } finally {
      setBusy(false)
    }
  }

  const leave = async () => {
    if (!userId) return
    setBusy(true)
    try {
      await leaveLeaderboard(userId)
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const me = rows.find((r) => r.isMe)

  return (
    <div className="kd-screen">
      <Header title="อันดับประจำเดือน" onBack={onBack} />
      <div className="kd-scroll" style={{ padding: '8px 16px 48px', display: 'grid', gap: 14, alignContent: 'start' }}>
        <div className="kd-card" style={{ padding: 16 }}>
          <div className="kd-row" style={{ gap: 10 }}>
            <Icon name="ph-fill ph-trophy" size={26} color="var(--ledger-debit)" />
            <div>
              <div className="kd-body" style={{ fontWeight: 500 }}>{THAI_MONTHS[now.getMonth()]} {now.getFullYear() + 543}</div>
              <div className="kd-caption kd-muted">แข่งกันจดอาหารให้ครบทุกวัน · ผ่านมาแล้ว {daysSoFar} วัน</div>
            </div>
          </div>
          <p className="kd-caption kd-muted" style={{ marginTop: 10 }}>
            นับจำนวนวันที่บันทึกอาหารอย่างน้อย 1 รายการในเดือนนี้ ไม่ได้วัดว่าใครกินน้อยกว่า
            คนอื่นเห็นแค่ชื่อเล่นกับจำนวนวัน ไม่เห็นอาหาร แคลอรี หรือน้ำหนักของคุณ
          </p>
        </div>

        {!userId ? (
          <div className="kd-card" style={{ padding: 16, display: 'grid', gap: 10 }}>
            <div className="kd-body" style={{ fontWeight: 500 }}>สร้างบัญชีฟรีเพื่อร่วมจัดอันดับ</div>
            <p className="kd-caption kd-muted">อันดับคำนวณจากข้อมูลที่ซิงก์ขึ้นคลาวด์ โหมดไม่สมัครสมาชิกจึงเข้าร่วมไม่ได้ ข้อมูลในเครื่องจะไม่ถูกลบ</p>
            <button className="kd-btn kd-btn-primary" onClick={() => setSession(null)}>สร้างบัญชี / เข้าสู่ระบบ</button>
          </div>
        ) : !online ? (
          <p className="kd-caption kd-muted" style={{ textAlign: 'center' }}>ต่ออินเทอร์เน็ตเพื่อดูอันดับ</p>
        ) : state === 'loading' ? (
          <div style={{ display: 'grid', gap: 8 }}>{[0, 1, 2, 3].map((i) => <div key={i} className="kd-skel" style={{ height: 48, borderRadius: 12 }} />)}</div>
        ) : state === 'error' ? (
          <div className="kd-card" style={{ padding: 16, display: 'grid', gap: 8 }}>
            <p className="kd-caption">โหลดอันดับไม่สำเร็จ</p>
            <button className="kd-btn kd-btn-outline" onClick={() => void refresh()}>ลองอีกครั้ง</button>
          </div>
        ) : (
          <>
            <div className="kd-card" style={{ padding: 16, display: 'grid', gap: 10 }}>
              {nickname ? (
                <>
                  <div className="kd-body">เข้าร่วมในชื่อ <strong>{nickname}</strong></div>
                  <div className="kd-caption kd-muted">
                    {me ? `อันดับ ${me.rank} · บันทึกแล้ว ${me.days} จาก ${daysSoFar} วัน` : 'ยังไม่มีบันทึกเดือนนี้ จดมื้อแรกเพื่อขึ้นตาราง'}
                  </div>
                  <div className="kd-row" style={{ gap: 8 }}>
                    <input className="kd-input" style={{ flex: 1 }} maxLength={24} value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="ชื่อเล่นที่แสดง" />
                    <button className="kd-chip" disabled={busy || !validNickname(draft) || draft.trim() === nickname} onClick={join}>เปลี่ยนชื่อ</button>
                  </div>
                  <button className="kd-btn-text" disabled={busy} onClick={leave} style={{ justifySelf: 'start' }}>ออกจากการจัดอันดับ</button>
                </>
              ) : (
                <>
                  <div className="kd-body" style={{ fontWeight: 500 }}>เข้าร่วมด้วยชื่อเล่น</div>
                  <p className="kd-caption kd-muted">อย่าใช้ชื่อจริงหรืออีเมล ออกจากการจัดอันดับได้ทุกเมื่อ</p>
                  <input className="kd-input" placeholder="ชื่อเล่น 2–24 ตัวอักษร" maxLength={24} value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="ชื่อเล่นที่แสดง" />
                  <button className="kd-btn kd-btn-primary" disabled={busy || !validNickname(draft)} onClick={join}>เข้าร่วม</button>
                </>
              )}
            </div>

            <div className="kd-card" style={{ overflow: 'hidden' }}>
              {rows.length === 0 ? (
                <p className="kd-caption kd-muted" style={{ padding: 16, textAlign: 'center' }}>ยังไม่มีใครในตารางเดือนนี้ เป็นคนแรกเลย</p>
              ) : rows.map((r) => (
                <div key={`${r.rank}-${r.displayName}-${r.isMe}`} className={`kd-rank-row${r.isMe ? ' me' : ''}`}>
                  <span className={`kd-rank-no tnum${r.rank <= 3 ? ' top' : ''}`}>{r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : r.rank}</span>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.displayName}{r.isMe ? ' (คุณ)' : ''}</span>
                  <strong className="tnum">{r.days} วัน</strong>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
