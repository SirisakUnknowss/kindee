import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../components/ui'
import {
  formatPrice, loadEntitlement, loadPlanPrices, openBillingPortal, planCatalog, startCheckout,
  type BillingInterval, type Entitlement, type PaidPlan, type PlanPrice,
} from '../lib/billing'
import type { Session } from '../lib/types'

const statusText: Record<Entitlement['status'], string> = {
  active: 'ใช้งานอยู่', trialing: 'ช่วงทดลองใช้ฟรี', past_due: 'รอการชำระเงิน', cancelled: 'ยกเลิกแล้ว',
  incomplete: 'ชำระเงินไม่สมบูรณ์', unpaid: 'ค้างชำระ', paused: 'หยุดชั่วคราว',
}

export function Pricing({ session, onBack, onRequireAccount }: {
  session: Session
  onBack: () => void
  onRequireAccount: () => void
}) {
  const [interval, setInterval] = useState<BillingInterval>('month')
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null)
  const [prices, setPrices] = useState<PlanPrice[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    void loadPlanPrices().then(setPrices).catch(() => setPrices([]))
    if (session.kind === 'account') {
      void loadEntitlement(session.userId).then(setEntitlement).catch(() => setMessage('โหลดสถานะสมาชิกไม่สำเร็จ ลองใหม่อีกครั้งนะ'))
    }
    const result = new URLSearchParams(window.location.search).get('billing')
    if (result === 'success') setMessage('รับคำขอแล้ว ระบบกำลังอัปเดตสถานะสมาชิก ซึ่งอาจใช้เวลาสักครู่')
    if (result === 'cancelled') setMessage('ยังไม่มีการเปลี่ยนแพ็กเกจ คุณกลับมาเลือกใหม่ได้เสมอ')
    if (result) window.history.replaceState({}, '', window.location.pathname)
  }, [session])

  const priceMap = useMemo(() => new Map((prices ?? []).map((price) => [`${price.plan}_${price.interval}`, price])), [prices])
  const currentPlan = entitlement && ['active', 'trialing', 'past_due'].includes(entitlement.status) ? entitlement.plan : 'free'
  const hasPaidPlan = currentPlan !== 'free'

  const choose = async (plan: PaidPlan) => {
    if (session.kind !== 'account') return onRequireAccount()
    setBusy(plan)
    setMessage(null)
    try {
      if (hasPaidPlan) await openBillingPortal()
      else await startCheckout(plan, interval)
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : ''
      setMessage(code === 'price_unconfigured' ? 'แพ็กเกจนี้ยังไม่ได้ตั้งราคาในระบบชำระเงิน' : 'เปิดหน้าชำระเงินไม่สำเร็จ ลองใหม่อีกครั้งนะ')
      setBusy(null)
    }
  }

  const manage = async () => {
    setBusy('manage')
    try { await openBillingPortal() } catch { setMessage('เปิดหน้าจัดการสมาชิกไม่สำเร็จ ลองใหม่อีกครั้งนะ'); setBusy(null) }
  }

  return (
    <div className="kd-screen kd-pricing-screen">
      <header className="kd-pricing-head">
        <button className="kd-icon-btn" onClick={onBack} aria-label="กลับ"><Icon name="ph ph-caret-left" size={21} /></button>
        <div>
          <h1 className="kd-h1">แพ็กเกจ KinDee</h1>
          <p className="kd-caption kd-muted">ทดลองใช้ฟรี 30 วันครั้งแรก แล้วค่อยเริ่มชำระ</p>
        </div>
      </header>

      <div className="kd-scroll kd-pricing-scroll">
        {entitlement && (
          <div className="kd-card kd-current-plan">
            <div><span className="kd-caption kd-muted">แพ็กเกจปัจจุบัน</span><strong>{entitlement.plan.toUpperCase()}</strong></div>
            <span className="kd-plan-status">{statusText[entitlement.status]}</span>
            {entitlement.trial_end && entitlement.status === 'trialing' && <small>ทดลองใช้ฟรีถึง {new Date(entitlement.trial_end).toLocaleDateString('th-TH', { dateStyle: 'medium' })}</small>}
            {entitlement.cancel_at_period_end && entitlement.period_end && <small>สิ้นสุดวันที่ {new Date(entitlement.period_end).toLocaleDateString('th-TH', { dateStyle: 'medium' })}</small>}
            {hasPaidPlan && <button className="kd-btn-text" onClick={manage} disabled={busy !== null}>จัดการการชำระเงิน</button>}
          </div>
        )}

        {message && <div className="kd-billing-message" role="status">{message}</div>}

        <div className="kd-billing-switch" role="group" aria-label="รอบชำระเงิน">
          <button className={interval === 'month' ? 'on' : ''} onClick={() => setInterval('month')}>รายเดือน</button>
          <button className={interval === 'year' ? 'on' : ''} onClick={() => setInterval('year')}>รายปี</button>
        </div>

        <div className="kd-plan-grid">
          {planCatalog.map((plan) => {
            const price = plan.id === 'free' ? undefined : priceMap.get(`${plan.id}_${interval}`)
            const isCurrent = currentPlan === plan.id
            return (
              <article key={plan.id} className={`kd-plan-card${plan.featured ? ' featured' : ''}`}>
                {plan.featured && <span className="kd-plan-badge">แนะนำ</span>}
                <div className="kd-row" style={{ alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}><h2>{plan.name}</h2><p>{plan.description}</p></div>
                  {isCurrent && <Icon name="ph-fill ph-check-circle" size={24} color="var(--accent)" />}
                </div>
                <div className="kd-plan-price">
                  {plan.id === 'free' ? 'ฟรี' : prices === null ? 'กำลังโหลดราคา…' : formatPrice(price)}
                  {plan.id !== 'free' && price && <small>/{interval === 'month' ? 'เดือน' : 'ปี'}</small>}
                </div>
                <ul>{plan.features.map((feature) => <li key={feature}><Icon name="ph ph-check" size={16} />{feature}</li>)}</ul>
                {plan.id === 'free' ? (
                  <button className="kd-btn kd-btn-outline" disabled={isCurrent || busy !== null} onClick={hasPaidPlan ? manage : undefined}>
                    {isCurrent ? 'แพ็กเกจปัจจุบัน' : 'เปลี่ยนเป็น Free'}
                  </button>
                ) : (
                  <button className={`kd-btn ${plan.featured ? 'kd-btn-primary' : 'kd-btn-outline'}`} disabled={busy !== null || !price} onClick={() => choose(plan.id as PaidPlan)}>
                    {busy === plan.id ? 'กำลังเปิด…' : isCurrent ? 'จัดการแพ็กเกจ' : hasPaidPlan ? 'เปลี่ยนแพ็กเกจ' : 'ทดลองใช้ฟรี 30 วัน'}
                  </button>
                )}
              </article>
            )
          })}
        </div>
        <p className="kd-caption kd-muted" style={{ textAlign: 'center', marginTop: 16 }}>
          ยกเลิกได้ทุกเมื่อผ่านหน้าจัดการสมาชิก · *อยู่ภายใต้นโยบายใช้งานที่เหมาะสม
        </p>
      </div>
    </div>
  )
}
