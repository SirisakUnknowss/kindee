export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export type Entry = {
  uid: string
  meal: Meal
  foodId: string
  unitIx: number
  amount: number
  /** วันที่แบบ YYYY-MM-DD — denormalize ไว้ query ง่าย */
  day: string
  /** kcal snapshot: ประวัติย้อนหลังต้องไม่ขยับเมื่อข้อมูลอาหารถูกแก้ */
  kcal: number
  /** ยังไม่ได้ซิงก์ขึ้น server */
  pending?: boolean
}

export type Profile = {
  sex: 'male' | 'female'
  bDay: number
  bMonth: number
  bYear: number
  height: number
  weight: number
  activity: 'sedentary' | 'light' | 'moderate' | 'active'
  goal: 'lose' | 'keep' | 'gain'
  /** เป้าที่ใช้จริง */
  target: number
  /** ถ้าผู้ใช้ตั้งเอง ห้ามเขียนทับตอนอัปเดตน้ำหนัก */
  targetSource: 'auto' | 'manual'
}

export type Session =
  | { kind: 'guest'; onboarded: boolean }
  | { kind: 'account'; email: string; userId: string; onboarded: boolean }

export type Toast = { text: string; undoUid?: string; entryUid?: string } | null
