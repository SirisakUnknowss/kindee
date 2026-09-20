import { supabase } from './supabase'

export type Plan = 'free' | 'plus' | 'pro' | 'unlimited'
export type PaidPlan = Exclude<Plan, 'free'>
export type BillingInterval = 'month' | 'year'

export type Entitlement = {
  user_id: string
  plan: Plan
  status: 'active' | 'trialing' | 'past_due' | 'cancelled' | 'incomplete' | 'unpaid' | 'paused'
  billing_interval: BillingInterval | null
  period_end: string | null
  trial_end: string | null
  cancel_at_period_end: boolean
}

export type PlanPrice = { plan: PaidPlan; interval: BillingInterval; amount: number; currency: string }

export const planCatalog: Array<{
  id: Plan
  name: string
  description: string
  features: string[]
  featured?: boolean
}> = [
  { id: 'free', name: 'Free', description: 'เริ่มดูแลอาหารได้ครบทุกวัน', features: ['บันทึกอาหารและคำนวณ TDEE', 'สำรองข้อมูลข้ามเครื่อง', 'วิเคราะห์รูปอาหาร 3 ครั้ง/เดือน'] },
  { id: 'plus', name: 'Plus', description: 'สำหรับคนที่อยากเห็นภาพรวมชัดขึ้น', features: ['ทุกอย่างใน Free', 'ประวัติและแนวโน้มไม่จำกัด', 'วิเคราะห์รูปอาหาร 30 ครั้ง/เดือน'] },
  { id: 'pro', name: 'Pro', description: 'ลงรายละเอียดเพื่อไปถึงเป้าหมาย', featured: true, features: ['ทุกอย่างใน Plus', 'เป้าหมายและ macro ขั้นสูง', 'วิเคราะห์รูปอาหาร 100 ครั้ง/เดือน'] },
  { id: 'unlimited', name: 'Unlimited', description: 'ใช้งานเต็มที่โดยไม่ต้องนับโควตา', features: ['ทุกอย่างใน Pro', 'วิเคราะห์รูปอาหารไม่จำกัด*', 'สิทธิ์ทดลองฟีเจอร์ใหม่ก่อนใคร'] },
]

async function accessToken() {
  const { data } = await supabase?.auth.getSession() ?? { data: { session: null } }
  if (!data.session) throw new Error('auth_required')
  return data.session.access_token
}

async function billingPost(path: string, body?: unknown) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { authorization: `Bearer ${await accessToken()}`, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const payload = await response.json().catch(() => ({})) as { url?: string; error?: { code?: string; message?: string } }
  if (!response.ok || !payload.url) throw new Error(payload.error?.code || 'billing_request_failed')
  window.location.assign(payload.url)
}

export async function loadEntitlement(userId: string): Promise<Entitlement | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from('entitlements').select(
    'user_id,plan,status,billing_interval,period_end,trial_end,cancel_at_period_end',
  ).eq('user_id', userId).maybeSingle()
  if (error) throw error
  return data as Entitlement | null
}

export async function loadPlanPrices(): Promise<PlanPrice[]> {
  const response = await fetch('/api/billing/plans')
  if (!response.ok) return []
  return ((await response.json()) as { prices?: PlanPrice[] }).prices ?? []
}

export const startCheckout = (plan: PaidPlan, interval: BillingInterval) =>
  billingPost('/api/billing/checkout', { plan, interval })

export const openBillingPortal = () => billingPost('/api/billing/portal')

export function formatPrice(price: PlanPrice | undefined) {
  if (!price) return 'ยังไม่เปิดขาย'
  const currency = price.currency.toUpperCase()
  const formatter = new Intl.NumberFormat('th-TH', { style: 'currency', currency, maximumFractionDigits: 0 })
  const digits = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2
  return formatter.format(price.amount / (10 ** digits))
}
