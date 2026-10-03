import thaiFoods from './thai-foods.json'

export type Quality = 'verified' | 'open' | 'user'
export type FoodCat = 'dish' | 'store' | 'drink' | 'sweet' | 'fruit'
export type Unit = { label: string; f: number }

export type Food = {
  id: string
  name: string
  /** จานปรุงสำเร็จ vs สินค้าบรรจุภัณฑ์ — ตัดสินโหมดของหน้าเลือกปริมาณ */
  kind: 'dish' | 'pack'
  cat: FoodCat
  /** kcal ต่อหน่วยแรกใน units */
  kcal: number
  q: Quality
  icon: string
  units: Unit[]
  brand?: string
  pack?: string
  /** ฉลากระบุกี่หน่วยบริโภคต่อบรรจุภัณฑ์ — ต่างจากขนาดบรรจุ ต้องแยกกัน */
  servings?: number
  /** macro ต่อหน่วยแรก (กรัม) */
  protein: number
  carb: number
  fat: number
  updated?: string
}

export const QUALITY: Record<Quality, { label: string; icon: string; color: string }> = {
  verified: { label: 'ตรวจสอบแล้ว', icon: 'ph-fill ph-seal-check', color: '#356b58' },
  open: { label: 'ฐานข้อมูลเปิด', icon: 'ph ph-globe-hemisphere-east', color: '#4e7180' },
  user: { label: 'ผู้ใช้เพิ่มเอง', icon: 'ph ph-user-circle', color: '#6e6750' },
}

export const FOODS: Food[] = [
  { id: 'steamed-rice', name: 'ข้าวสวย', kcal: 234, kind: 'dish', q: 'open', icon: 'ph ph-bowl-food', cat: 'dish',
    protein: 4.3, carb: 51.5, fat: 0.5,
    units: [{ label: 'จาน (180 ก.)', f: 1 }, { label: 'ทัพพี (60 ก.)', f: 1 / 3 }, { label: 'ถ้วย (150 ก.)', f: 5 / 6 }] },
  { id: 'butter-cookie', name: 'คุกกี้เนย', kcal: 70, kind: 'dish', q: 'open', icon: 'ph ph-cookie', cat: 'sweet',
    protein: 1, carb: 9, fat: 3.5,
    units: [{ label: 'ชิ้น (15 ก.)', f: 1 }, { label: '2 ชิ้น', f: 2 }, { label: '100 ก.', f: 100 / 15 }] },
  { id: 'kaprao', name: 'ข้าวกะเพราหมูสับไข่ดาว', kcal: 620, kind: 'dish', q: 'verified', icon: 'ph ph-bowl-food', cat: 'dish',
    protein: 28, carb: 74, fat: 24, updated: '12 ก.ค. 2026',
    units: [{ label: 'จาน', f: 1 }, { label: 'ทัพพี', f: 0.42 }, { label: 'ถ้วย', f: 0.6 }] },
  { id: 'moo-ping', name: 'หมูปิ้ง + ข้าวเหนียว', kcal: 410, kind: 'dish', q: 'verified', icon: 'ph ph-fire', cat: 'dish',
    protein: 18, carb: 56, fat: 12, updated: '2 ก.ค. 2026',
    units: [{ label: 'ไม้ + ห่อ', f: 1 }, { label: 'ไม้', f: 0.36 }] },
  { id: 'somtam', name: 'ส้มตำไทย', kcal: 120, kind: 'dish', q: 'verified', icon: 'ph ph-carrot', cat: 'dish',
    protein: 4, carb: 22, fat: 2,
    units: [{ label: 'จาน', f: 1 }, { label: 'ถ้วย', f: 0.7 }] },
  { id: 'joke', name: 'โจ๊กหมูใส่ไข่', kcal: 280, kind: 'dish', q: 'open', icon: 'ph ph-bowl-steam', cat: 'dish',
    protein: 16, carb: 38, fat: 7,
    units: [{ label: 'ถ้วย', f: 1 }, { label: 'ชาม', f: 1.5 }] },
  { id: 'khao-man-kai', name: 'ข้าวมันไก่ต้ม', kcal: 590, kind: 'dish', q: 'verified', icon: 'ph ph-bowl-food', cat: 'dish',
    protein: 27, carb: 78, fat: 19,
    units: [{ label: 'จาน', f: 1 }, { label: 'ทัพพี', f: 0.4 }] },
  { id: 'cha-yen', name: 'ชาไทยเย็น หวานน้อย', kcal: 180, kind: 'dish', q: 'open', icon: 'ph ph-coffee', cat: 'drink',
    protein: 3, carb: 30, fat: 5,
    units: [{ label: 'แก้ว', f: 1 }, { label: 'แก้วใหญ่', f: 1.4 }] },
  { id: 'americano', name: 'อเมริกาโน่เย็น ไม่หวาน', kcal: 10, kind: 'dish', q: 'verified', icon: 'ph ph-coffee', cat: 'drink',
    protein: 0, carb: 2, fat: 0,
    units: [{ label: 'แก้ว', f: 1 }] },
  { id: 'khai-tom', name: 'ไข่ต้ม', kcal: 78, kind: 'dish', q: 'verified', icon: 'ph ph-egg', cat: 'dish',
    protein: 6, carb: 1, fat: 5,
    units: [{ label: 'ฟอง', f: 1 }] },
  { id: 'foremost', name: 'นมพร่องมันเนย UHT รสจืด ตราโฟร์โมสต์ 180 มล.', brand: 'โฟร์โมสต์', pack: '1 กล่อง = 180 มล.', kcal: 92, kind: 'pack', q: 'verified', icon: 'ph ph-drop', cat: 'store',
    protein: 6, carb: 9, fat: 3, updated: '18 มิ.ย. 2026',
    units: [{ label: 'ทั้งกล่อง', f: 1 }, { label: 'ครึ่งกล่อง', f: 0.5 }, { label: 'ต่อ 100 มล.', f: 0.51 }] },
  { id: 'taokaenoi', name: 'สาหร่ายทอด เถ้าแก่น้อย รสดั้งเดิม 32 ก.', brand: 'เถ้าแก่น้อย', pack: '1 ซอง = 32 ก. · ฉลากระบุ 2 หน่วยบริโภค', kcal: 178, kind: 'pack', q: 'open', icon: 'ph ph-package', cat: 'store', servings: 2,
    protein: 4, carb: 15, fat: 11, updated: '3 พ.ค. 2026',
    units: [{ label: 'ทั้งซอง', f: 1 }, { label: 'ครึ่งซอง', f: 0.5 }, { label: 'ต่อหน่วยบริโภค', f: 0.5 }, { label: 'ต่อ 100 ก.', f: 3.13 }] },
  { id: 'mama-cup', name: 'มาม่า คัพ ต้มยำกุ้ง 60 ก.', brand: 'มาม่า', pack: '1 ถ้วย = 60 ก.', kcal: 350, kind: 'pack', q: 'verified', icon: 'ph ph-bowl-steam', cat: 'store',
    protein: 7, carb: 45, fat: 16,
    units: [{ label: 'ทั้งถ้วย', f: 1 }, { label: 'ครึ่งถ้วย', f: 0.5 }, { label: 'ต่อ 100 ก.', f: 1.67 }] },
  { id: 'vitamilk', name: 'นมถั่วเหลืองไวตามิ้ลค์ สูตรน้ำตาลน้อย 300 มล.', brand: 'ไวตามิ้ลค์', pack: '1 ขวด = 300 มล.', kcal: 165, kind: 'pack', q: 'open', icon: 'ph ph-drop', cat: 'store',
    protein: 8, carb: 22, fat: 5,
    units: [{ label: 'ทั้งขวด', f: 1 }, { label: 'ครึ่งขวด', f: 0.5 }, { label: 'ต่อ 100 มล.', f: 0.33 }] },
  { id: 'dutchmill', name: 'นมเปรี้ยวดัชมิลล์ รสสตรอว์เบอร์รี 180 มล.', brand: 'ดัชมิลล์', pack: '1 ขวด = 180 มล.', kcal: 145, kind: 'pack', q: 'user', icon: 'ph ph-drop', cat: 'store',
    protein: 3, carb: 30, fat: 1,
    units: [{ label: 'ทั้งขวด', f: 1 }, { label: 'ครึ่งขวด', f: 0.5 }] },
  { id: 'sandwich', name: 'แซนด์วิชแฮมชีส 7-Eleven', brand: '7-Eleven', pack: '1 ชิ้น = 118 ก.', kcal: 289, kind: 'pack', q: 'verified', icon: 'ph ph-hamburger', cat: 'store',
    protein: 12, carb: 33, fat: 12,
    units: [{ label: 'ทั้งชิ้น', f: 1 }, { label: 'ครึ่งชิ้น', f: 0.5 }] },
  { id: 'banana', name: 'กล้วยน้ำว้า', kcal: 100, kind: 'dish', q: 'verified', icon: 'ph ph-leaf', cat: 'fruit',
    protein: 1, carb: 26, fat: 0,
    units: [{ label: 'ลูก', f: 1 }, { label: 'ลูกใหญ่', f: 1.3 }] },
  { id: 'khanom-tuay', name: 'ขนมถ้วย', kcal: 130, kind: 'dish', q: 'open', icon: 'ph ph-cookie', cat: 'sweet',
    protein: 1, carb: 20, fat: 5,
    units: [{ label: 'ถ้วย', f: 1 }, { label: '2 ถ้วย', f: 2 }] },
]

// The same curated catalogue is seeded into Supabase and bundled here so the
// full searchable menu remains available offline. Keep hand-curated overrides
// above the generated data when names overlap.
const handCuratedNames = new Set(FOODS.map((food) => food.name))
FOODS.push(...thaiFoods
  .filter((food) => !handCuratedNames.has(food.name))
  .map((food) => {
    const grams = food.grams
    return {
      id: food.id,
      name: food.name,
      kind: 'dish' as const,
      cat: food.cat as FoodCat,
      kcal: Math.round(food.kcal100g * grams / 100),
      q: 'open' as const,
      icon: food.cat === 'drink' ? 'ph ph-coffee' : food.cat === 'sweet' ? 'ph ph-cookie' : 'ph ph-bowl-food',
      protein: Math.round(food.protein100g * grams / 100 * 10) / 10,
      carb: Math.round(food.carb100g * grams / 100 * 10) / 10,
      fat: Math.round(food.fat100g * grams / 100 * 10) / 10,
      units: [
        { label: `${food.portion} (${grams} ก.)`, f: 1 },
        { label: `ครึ่ง${food.portion}`, f: 0.5 },
        { label: '100 ก.', f: Math.round(100 / grams * 100) / 100 },
      ],
    }
  }))

export const foodById = (id: string): Food =>
  FOODS.find((f) => f.id === id) ?? FOODS[0]

export function registerRuntimeFood(food: Food) {
  const index = FOODS.findIndex((item) => item.id === food.id)
  if (index >= 0) FOODS[index] = food
  else FOODS.push(food)
  return food
}

/** คลังที่ bundle มากับแอป ใช้ได้ตอนออฟไลน์ */
export const OFFLINE_COUNT = FOODS.length

export const FILTERS: { id: 'all' | FoodCat; label: string }[] = [
  { id: 'all', label: 'ทั้งหมด' },
  { id: 'dish', label: 'อาหารจานเดียว' },
  { id: 'store', label: 'สินค้าในร้าน' },
  { id: 'drink', label: 'เครื่องดื่ม' },
  { id: 'sweet', label: 'ของหวาน' },
  { id: 'fruit', label: 'ผลไม้' },
]
