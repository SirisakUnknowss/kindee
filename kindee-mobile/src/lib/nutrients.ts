import type { Entry, Profile } from './types'

export type Nutrients = { protein: number; carb: number; fat: number }
// ISSN protein/exercise (2017): 1.4–2.0 g/kg for exercising adults.
// General plan: at least 0.8 g/kg protein; fat 30% energy; carbs use remainder.
export function nutrientTargets(p: Pick<Profile, 'weight' | 'target'>, muscle: boolean): Nutrients | null {
  if (!Number.isFinite(p.weight) || !Number.isFinite(p.target) || p.weight <= 0 || p.target <= 0) return null
  const protein = Math.max(p.weight * (muscle ? 1.6 : 0.8), p.target * 0.1 / 4)
  const fat = p.target * 0.3 / 9
  const carb = (p.target - protein * 4 - fat * 9) / 4
  // Do not invent a high-protein plan when the calorie budget cannot support it.
  if (protein * 4 > p.target * 0.35 || carb < 0) return null
  return { protein, carb, fat }
}

export function missingNutrients(entries: Entry[]) {
  return entries.filter(e => ['protein', 'carb', 'fat'].some(k => {
    const value = e[k as keyof Nutrients]
    return value == null || !Number.isFinite(value) || value < 0
  })).length
}

export function nutrientStatus(consumed: number, target: number, protein: boolean) {
  const delta = target - consumed
  if (protein && delta <= 0) return 'ถึงเป้าที่วางไว้แล้ว'
  return `${delta >= 0 ? (protein ? 'ยังขาด' : 'เหลือในงบ') : 'เกินงบที่วางไว้'} ${Math.round(Math.abs(delta))} ก.`
}

export const nutrientExplanation = 'คาร์บเป็นงบจากแคลอรีที่เหลือหลังโปรตีนและไขมัน ไม่ใช่เพดานสุขภาพตายตัว ตัวเลขเป็นค่าประมาณ การสร้างกล้ามเนื้อต้องมีการฝึกแรงต้านและพักผ่อนร่วมด้วย'
export const nutrientSources = [
  { label: 'ISSN: โปรตีนและการออกกำลังกาย', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5477153/' },
  { label: 'National Academies: สัดส่วนสารอาหาร', url: 'https://www.nationalacademies.org/publications/10490' },
]
