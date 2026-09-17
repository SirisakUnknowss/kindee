/** ฟังก์ชันบริสุทธิ์ทั้งหมด ไม่แตะ DB — เขียนเทสต์ได้ */
import { foodById } from '../data/foods'
import type { Entry, Profile } from './types'

export const ACTIVITY = [
  { id: 'sedentary', label: 'นั่งทำงานเป็นหลัก', desc: 'แทบไม่ได้ออกกำลังกาย', f: 1.2, icon: 'ph ph-desktop' },
  { id: 'light', label: 'เบา', desc: 'ออกกำลังกาย 1–3 วัน/สัปดาห์', f: 1.375, icon: 'ph ph-person-simple-walk' },
  { id: 'moderate', label: 'ปานกลาง', desc: 'ออกกำลังกาย 3–5 วัน/สัปดาห์', f: 1.55, icon: 'ph ph-person-simple-run' },
  { id: 'active', label: 'หนัก', desc: 'ออกกำลังกาย 6–7 วัน/สัปดาห์', f: 1.725, icon: 'ph ph-barbell' },
] as const

export const GOALS = [
  { id: 'lose', label: 'ลดน้ำหนัก', desc: 'ค่อย ๆ ลดอย่างยั่งยืน', delta: -500, icon: 'ph ph-trend-down' },
  { id: 'keep', label: 'คงน้ำหนัก', desc: 'รักษาน้ำหนักปัจจุบันไว้', delta: 0, icon: 'ph ph-equals' },
  { id: 'gain', label: 'เพิ่มน้ำหนัก', desc: 'เพิ่มอย่างค่อยเป็นค่อยไป', delta: 350, icon: 'ph ph-trend-up' },
] as const

export const activityFactor = (id: Profile['activity']) =>
  ACTIVITY.find((a) => a.id === id)!.f

export const goalDelta = (id: Profile['goal']) => GOALS.find((g) => g.id === id)!.delta

export function ageFrom(day: number, month: number, year: number, now = new Date()) {
  let age = now.getFullYear() - year
  const beforeBirthday =
    now.getMonth() + 1 < month || (now.getMonth() + 1 === month && now.getDate() < day)
  if (beforeBirthday) age -= 1
  return Math.max(0, age)
}

/** Mifflin–St Jeor */
export function bmr(p: Pick<Profile, 'sex' | 'weight' | 'height'>, age: number) {
  const base = 10 * p.weight + 6.25 * p.height - 5 * age
  return Math.round(base + (p.sex === 'male' ? 5 : -161))
}

export const tdee = (bmrValue: number, activity: Profile['activity']) =>
  Math.round(bmrValue * activityFactor(activity))

/** ตัวกันด้านล่าง — ห้ามต่ำกว่านี้ไม่ว่าคำนวณได้เท่าไร */
export const floorFor = (sex: Profile['sex']) => (sex === 'male' ? 1500 : 1200)

export type TargetBreakdown = {
  age: number
  bmr: number
  tdee: number
  raw: number
  floor: number
  target: number
  /** true = ถูกดันขึ้นมาที่ค่าขั้นต่ำ ต้องแสดงข้อความห่วงใย */
  floored: boolean
}

export function computeTarget(p: Profile, now = new Date()): TargetBreakdown {
  const age = ageFrom(p.bDay, p.bMonth, p.bYear, now)
  const b = bmr(p, age)
  const t = tdee(b, p.activity)
  const raw = t + goalDelta(p.goal)
  const floor = floorFor(p.sex)
  const rounded = Math.round(raw / 10) * 10
  return { age, bmr: b, tdee: t, raw, floor, target: Math.max(floor, rounded), floored: rounded < floor }
}

export const entryKcal = (e: Entry) => {
  if (e.entrySource === 'manual') return e.kcal
  const f = foodById(e.foodId)
  return Math.round(f.kcal * f.units[e.unitIx].f * e.amount)
}

export function entryMacros(e: Entry) {
  if (e.entrySource === 'manual') {
    return { protein: e.protein ?? 0, carb: e.carb ?? 0, fat: e.fat ?? 0 }
  }
  const f = foodById(e.foodId)
  const m = f.units[e.unitIx].f * e.amount
  return { protein: f.protein * m, carb: f.carb * m, fat: f.fat * m }
}

export const totalKcal = (entries: Entry[]) => entries.reduce((s, e) => s + entryKcal(e), 0)

export function totalMacros(entries: Entry[]) {
  return entries.reduce(
    (acc, e) => {
      const m = entryMacros(e)
      return { protein: acc.protein + m.protein, carb: acc.carb + m.carb, fat: acc.fat + m.fat }
    },
    { protein: 0, carb: 0, fat: 0 },
  )
}

export type RingTone = 'far' | 'mid' | 'near' | 'over'

/** ไล่ระดับต่อเนื่อง ไม่ใช่ดี/แย่ — และไม่มีสีแดง */
export function ringTone(consumed: number, target: number): RingTone {
  if (consumed > target) return 'over'
  const pct = target > 0 ? consumed / target : 0
  if (pct < 0.45) return 'far'
  if (pct < 0.85) return 'mid'
  return 'near'
}

export const ringColor = (tone: RingTone) => `var(--status-${tone})`

export const num = (n: number) => Math.round(n).toLocaleString('en-US')

export const amountLabel = (a: number) => (a === 0.5 ? '½' : a === 1.5 ? '1½' : String(a))

export const MEALS = [
  { id: 'breakfast', label: 'เช้า', icon: 'ph ph-sun-dim' },
  { id: 'lunch', label: 'กลางวัน', icon: 'ph ph-sun' },
  { id: 'dinner', label: 'เย็น', icon: 'ph ph-moon' },
  { id: 'snack', label: 'ของว่าง', icon: 'ph ph-cookie' },
] as const

export const mealLabel = (id: Entry['meal']) => MEALS.find((m) => m.id === id)!.label

/** ชิปมื้อเลือกอัตโนมัติตามเวลาปัจจุบัน */
export function mealForHour(h: number): Entry['meal'] {
  if (h < 10) return 'breakfast'
  if (h < 15) return 'lunch'
  if (h < 21) return 'dinner'
  return 'snack'
}
