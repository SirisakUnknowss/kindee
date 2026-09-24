import { useCallback, useEffect, useMemo, useState } from 'react'
import { Icon } from '../components/ui'
import { loadMonitoring, type MonitoringData } from '../lib/admin'

type View = 'overview' | 'users' | 'logs'
const planColor: Record<string, string> = { free: '#89918a', plus: '#72a493', pro: '#3f7d68', unlimited: '#285c50' }
const compact = (value: number) => new Intl.NumberFormat('th-TH', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
const dateTime = (value: string | null) => value ? new Date(value).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : 'ยังไม่เคย'
const safeLogUrl = (value: string | null) => {
  if (!value) return null
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null
  } catch { return null }
}

export function AdminDashboard({ onExit, onSignOut }: {
  onExit: () => void
  onSignOut: () => void
}) {
  const [view, setView] = useState<View>('overview')
  const [data, setData] = useState<MonitoringData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [plan, setPlan] = useState('all')
  const [logKind, setLogKind] = useState('all')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try { setData(await loadMonitoring()) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'monitoring_failed') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const users = useMemo(() => (data?.users ?? []).filter((user) =>
    (plan === 'all' || user.plan === plan) &&
    (!query || `${user.email} ${user.id}`.toLowerCase().includes(query.toLowerCase())),
  ), [data, plan, query])
  const logs = useMemo(() => (data?.logs ?? []).filter((log) =>
    (logKind === 'all' || log.kind === logKind) &&
    (!query || `${log.message} ${log.detail ?? ''} ${log.user_id ?? ''}`.toLowerCase().includes(query.toLowerCase())),
  ), [data, logKind, query])

  if (error === 'forbidden' || error === 'mfa_required' || error === 'unauthorized') {
    return <div className="kd-admin-gate"><Icon name="ph ph-lock-key" size={40} /><h1>ไม่มีสิทธิ์เข้าถึง</h1><p>บัญชีผู้ดูแลนี้ยังไม่ได้รับสิทธิ์ หรือจำเป็นต้องยืนยัน MFA ใหม่</p><button className="kd-btn kd-btn-outline" onClick={onSignOut}>ออกจากระบบผู้ดูแล</button></div>
  }

  return (
    <div className="kd-admin">
      <aside className="kd-admin-sidebar">
        <div className="kd-admin-brand"><span><Icon name="ph ph-bowl-food" size={22} /></span><div><strong>KinDee</strong><small>Monitoring</small></div></div>
        <nav>
          {([
            ['overview', 'ภาพรวม', 'ph ph-squares-four'],
            ['users', 'ผู้ใช้งาน', 'ph ph-users-three'],
            ['logs', 'Logs และ Feedback', 'ph ph-list-magnifying-glass'],
          ] as const).map(([id, label, icon]) => <button key={id} className={view === id ? 'on' : ''} onClick={() => { setView(id); setQuery('') }}><Icon name={icon} size={20} />{label}</button>)}
        </nav>
        <button className="kd-admin-exit" onClick={onExit}><Icon name="ph ph-arrow-square-out" size={18} />กลับไปที่แอป</button>
        <button className="kd-admin-exit" onClick={onSignOut}><Icon name="ph ph-sign-out" size={18} />ออกจากระบบผู้ดูแล</button>
      </aside>

      <main className="kd-admin-main">
        <header className="kd-admin-topbar">
          <div><p>ระบบหลังบ้าน</p><h1>{view === 'overview' ? 'ภาพรวมการใช้งาน' : view === 'users' ? 'ผู้ใช้งาน' : 'Logs และ Feedback'}</h1></div>
          <div className="kd-admin-actions"><span>{data ? `อัปเดต ${dateTime(data.generatedAt)}` : 'กำลังเตรียมข้อมูล'}</span><button onClick={refresh} disabled={loading}><Icon name={`ph ph-arrows-clockwise${loading ? ' kd-spin' : ''}`} size={19} />รีเฟรช</button></div>
        </header>

        {error && <div className="kd-admin-alert">โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง</div>}
        {!data && !error && <div className="kd-admin-loading"><span /><p>กำลังรวบรวมข้อมูลระบบ…</p></div>}

        {data && view === 'overview' && <Overview data={data} />}
        {data && view === 'users' && <Users data={data} users={users} query={query} setQuery={setQuery} plan={plan} setPlan={setPlan} />}
        {data && view === 'logs' && <Logs logs={logs} query={query} setQuery={setQuery} kind={logKind} setKind={setLogKind} />}
      </main>
    </div>
  )
}

function Overview({ data }: { data: MonitoringData }) {
  const cards = [
    ['ผู้ใช้ทั้งหมด', data.summary.totalUsers, `+${data.summary.newUsers7d} ใน 7 วัน`, 'ph ph-users-three'],
    ['Active 7 วัน', data.summary.activeUsers7d, 'จากการเข้าสู่ระบบ', 'ph ph-pulse'],
    ['รายการอาหาร', data.summary.totalEntries, 'รายการที่ยังใช้งาน', 'ph ph-bowl-food'],
    ['วิเคราะห์รูป', data.summary.totalPhotoJobs, `${data.summary.failedPhotoJobs} งานล้มเหลว`, 'ph ph-camera'],
  ] as const
  const maxSeries = Math.max(1, ...data.series.map((point) => point.entries))
  const totalPlans = Math.max(1, data.plans.reduce((sum, row) => sum + row.count, 0))
  return <div className="kd-admin-content">
    <section className="kd-admin-kpis">{cards.map(([label, value, note, icon]) => <article key={label}><div><span>{label}</span><strong>{compact(value)}</strong><small>{note}</small></div><i><Icon name={icon} size={22} /></i></article>)}</section>
    <section className="kd-admin-grid">
      <article className="kd-admin-panel kd-admin-chart"><div className="kd-admin-panel-head"><div><h2>กิจกรรม 14 วัน</h2><p>จำนวนรายการอาหารที่บันทึกต่อวัน</p></div></div><div className="kd-admin-bars">{data.series.map((point) => <div key={point.day} title={`${point.day}: ${point.entries} รายการ`}><i style={{ height: `${Math.max(4, point.entries / maxSeries * 100)}%` }} /><span>{new Date(`${point.day}T12:00:00`).toLocaleDateString('th-TH', { day: 'numeric' })}</span></div>)}</div></article>
      <article className="kd-admin-panel"><div className="kd-admin-panel-head"><div><h2>แพ็กเกจสมาชิก</h2><p>ผู้ใช้ตาม entitlement ปัจจุบัน</p></div></div><div className="kd-plan-donut" style={{ background: `conic-gradient(${data.plans.map((row, index) => { const before = data.plans.slice(0, index).reduce((sum, item) => sum + item.count, 0) / totalPlans * 100; const after = before + row.count / totalPlans * 100; return `${planColor[row.plan]} ${before}% ${after}%` }).join(',')})` }}><span><strong>{totalPlans}</strong><small>บัญชี</small></span></div><div className="kd-admin-legend">{data.plans.map((row) => <div key={row.plan}><i style={{ background: planColor[row.plan] }} /><span>{row.plan}</span><strong>{row.count}</strong></div>)}</div></article>
    </section>
    <section className="kd-admin-health"><article><Icon name="ph ph-warning-circle" size={22} /><div><span>Errors ที่ยังไม่ปิด</span><strong>{data.summary.unresolvedErrors}</strong></div></article><article><Icon name="ph ph-star" size={22} /><div><span>คะแนน Feedback เฉลี่ย</span><strong>{data.summary.averageRating?.toFixed(1) ?? '—'} <small>/ 5</small></strong></div></article><article><Icon name="ph ph-check-circle" size={22} /><div><span>Photo success rate</span><strong>{data.summary.totalPhotoJobs ? `${Math.round((1 - data.summary.failedPhotoJobs / data.summary.totalPhotoJobs) * 100)}%` : '—'}</strong></div></article></section>
  </div>
}

function Users({ users, query, setQuery, plan, setPlan }: { data: MonitoringData; users: MonitoringData['users']; query: string; setQuery: (v: string) => void; plan: string; setPlan: (v: string) => void }) {
  return <div className="kd-admin-content"><div className="kd-admin-filters"><label><Icon name="ph ph-magnifying-glass" size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาอีเมลหรือ User ID" /></label><select value={plan} onChange={(event) => setPlan(event.target.value)}><option value="all">ทุกแพ็กเกจ</option><option value="free">Free</option><option value="plus">Plus</option><option value="pro">Pro</option><option value="unlimited">Unlimited</option></select></div><div className="kd-admin-panel kd-admin-table-wrap"><table><thead><tr><th>ผู้ใช้</th><th>แพ็กเกจ</th><th>เข้าใช้ล่าสุด</th><th>Entries 14 วัน</th><th>รูปเดือนนี้</th><th>สถานะ</th></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td><strong>{user.email}</strong><small>{user.id}</small></td><td><span className={`kd-admin-plan ${user.plan}`}>{user.plan}</span></td><td>{dateTime(user.lastSignInAt)}</td><td>{user.entries14d}</td><td>{user.photosThisMonth}</td><td><span className={`kd-admin-status ${user.status}`}>{user.status}</span></td></tr>)}</tbody></table>{!users.length && <div className="kd-admin-empty">ไม่พบผู้ใช้ที่ตรงกับตัวกรอง</div>}</div></div>
}

function Logs({ logs, query, setQuery, kind, setKind }: { logs: MonitoringData['logs']; query: string; setQuery: (v: string) => void; kind: string; setKind: (v: string) => void }) {
  return <div className="kd-admin-content"><div className="kd-admin-filters"><label><Icon name="ph ph-magnifying-glass" size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาข้อความ รายละเอียด หรือ User ID" /></label><select value={kind} onChange={(event) => setKind(event.target.value)}><option value="all">ทุกประเภท</option><option value="error">Error</option><option value="feedback">Feedback</option></select></div><div className="kd-admin-log-list">{logs.map((log) => { const link = safeLogUrl(log.url); return <article key={log.id} className={`kd-admin-log ${log.kind}`}><div className="kd-admin-log-icon"><Icon name={log.kind === 'error' ? 'ph ph-warning' : 'ph ph-chat-circle-text'} size={20} /></div><div><div className="kd-admin-log-meta"><span>{log.kind}</span><time>{dateTime(log.created_at)}</time>{log.rating && <b>{'★'.repeat(log.rating)}</b>}</div><h3>{log.message}</h3><p>{log.user_id ? `User ${log.user_id}` : `Device ${log.installation_id ?? 'unknown'}`} · {log.app_version ?? 'unknown version'}</p>{log.detail && <details><summary>ดูรายละเอียด</summary><pre>{log.detail}</pre></details>}{link && <a href={link} target="_blank" rel="noreferrer">เปิดหน้าที่เกิดเหตุ <Icon name="ph ph-arrow-up-right" size={14} /></a>}</div></article> })}{!logs.length && <div className="kd-admin-empty">ยังไม่มี log ที่ตรงกับตัวกรอง</div>}</div></div>
}
