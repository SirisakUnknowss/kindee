/** ติดตามรูปร่าง — ฟังก์ชันบริสุทธิ์ (ใช้ร่วมกับ kindee-mobile แบบไฟล์เดียวกัน) */
import { computeTarget } from './calc'
import type { Profile } from './types'

export type MeasureKey = 'weight' | 'height' | 'shoulder' | 'chest' | 'waist' | 'hip' | 'thigh' | 'calf'

export type BodyValues = Partial<Record<MeasureKey, number>>

/** บันทึกได้วันละหนึ่งชุด — วันที่ (YYYY-MM-DD) เป็นคีย์ */
export type BodyMeasurement = BodyValues & { day: string; updatedAt: string; pending?: boolean }

export const MEASURES: { key: MeasureKey; label: string; unit: string; min: number; max: number }[] = [
  { key: 'weight', label: 'น้ำหนัก', unit: 'กก.', min: 20, max: 400 },
  { key: 'height', label: 'ส่วนสูง', unit: 'ซม.', min: 80, max: 250 },
  { key: 'shoulder', label: 'รอบไหล่', unit: 'ซม.', min: 50, max: 200 },
  { key: 'chest', label: 'รอบอก', unit: 'ซม.', min: 40, max: 250 },
  { key: 'waist', label: 'รอบเอว', unit: 'ซม.', min: 30, max: 250 },
  { key: 'hip', label: 'รอบสะโพก', unit: 'ซม.', min: 40, max: 250 },
  { key: 'thigh', label: 'รอบต้นขา', unit: 'ซม.', min: 20, max: 150 },
  { key: 'calf', label: 'รอบน่อง', unit: 'ซม.', min: 15, max: 100 },
]

export const measureMeta = (key: MeasureKey) => MEASURES.find((m) => m.key === key)!

/** หน่วยความยาวที่ผู้ใช้เลือกดู/กรอก — เก็บจริงเป็นซม. เสมอ น้ำหนักเป็นกก. เสมอ */
export type LengthUnit = 'cm' | 'in'

export const CM_PER_INCH = 2.54

const round1 = (n: number) => Math.round(n * 10) / 10

export const unitLabel = (key: MeasureKey, unit: LengthUnit) =>
  key === 'weight' ? 'กก.' : unit === 'in' ? 'นิ้ว' : 'ซม.'

/** ค่าที่เก็บ (ซม./กก.) → หน่วยที่แสดง ทศนิยม 1 ตำแหน่ง ใช้กับค่าส่วนต่างได้ด้วย */
export const toUnit = (key: MeasureKey, value: number, unit: LengthUnit) =>
  key !== 'weight' && unit === 'in' ? round1(value / CM_PER_INCH) : value

/** หน่วยที่กรอก → ซม./กก. (ยังไม่ปัดเศษ) */
export const fromUnit = (key: MeasureKey, value: number, unit: LengthUnit) =>
  key !== 'weight' && unit === 'in' ? value * CM_PER_INCH : value

export type Period = 'day' | 'week' | 'month'

export const PERIODS: { id: Period; label: string; previous: string }[] = [
  { id: 'day', label: 'รายวัน', previous: 'ครั้งก่อน' },
  { id: 'week', label: 'รายสัปดาห์', previous: 'สัปดาห์ก่อน' },
  { id: 'month', label: 'รายเดือน', previous: 'เดือนก่อน' },
]

const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

const pad = (n: number) => String(n).padStart(2, '0')
const parseDay = (day: string) => {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}
const formatDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export const isDayKey = (day: string) => /^\d{4}-\d{2}-\d{2}$/.test(day) && formatDay(parseDay(day)) === day

/** วันแรกของช่วง: วันนั้นเอง / วันจันทร์ของสัปดาห์ / วันที่ 1 ของเดือน */
export function periodStart(day: string, period: Period): string {
  if (period === 'day') return day
  const d = parseDay(day)
  if (period === 'month') return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return formatDay(d)
}

export function shortDay(day: string) {
  const d = parseDay(day)
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]}`
}

export function periodLabel(start: string, period: Period) {
  const d = parseDay(start)
  if (period === 'month') return `${THAI_MONTHS[d.getMonth()]} ${String(d.getFullYear() + 543).slice(-2)}`
  if (period === 'day') return shortDay(start)
  const end = new Date(d)
  end.setDate(end.getDate() + 6)
  return d.getMonth() === end.getMonth()
    ? `${d.getDate()}–${end.getDate()} ${THAI_MONTHS[d.getMonth()]}`
    : `${shortDay(start)} – ${shortDay(formatDay(end))}`
}

export type PeriodRow = {
  start: string
  label: string
  /** จำนวนวันที่มีการวัดในช่วงนี้ */
  count: number
  /** ค่าเฉลี่ยของช่วง (ทศนิยม 1 ตำแหน่ง) เฉพาะค่าที่วัดจริง */
  values: BodyValues
  /** ส่วนต่างจากช่วงก่อนหน้าที่มีค่านั้น — ไม่มีคีย์ถ้าไม่มีช่วงก่อนให้เทียบ */
  change: BodyValues
}

/**
 * รวมค่าวัดเป็นช่วง วัน/สัปดาห์/เดือน เรียงจากเก่าไปใหม่
 * ค่าที่ไม่ได้วัด (undefined) ไม่ถูกนับเป็นศูนย์ และค่าเปลี่ยนแปลงเทียบกับช่วงล่าสุดก่อนหน้าที่วัดค่านั้นไว้
 */
export function aggregate(rows: BodyMeasurement[], period: Period): PeriodRow[] {
  const buckets = new Map<string, { count: number; sums: BodyValues; counts: BodyValues }>()
  for (const row of rows) {
    if (!isDayKey(row.day)) continue
    const start = periodStart(row.day, period)
    const bucket = buckets.get(start) ?? { count: 0, sums: {}, counts: {} }
    let any = false
    for (const { key } of MEASURES) {
      const v = row[key]
      if (typeof v !== 'number' || !Number.isFinite(v)) continue
      bucket.sums[key] = (bucket.sums[key] ?? 0) + v
      bucket.counts[key] = (bucket.counts[key] ?? 0) + 1
      any = true
    }
    if (!any) continue
    bucket.count += 1
    buckets.set(start, bucket)
  }
  const last: BodyValues = {}
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([start, bucket]) => {
      const values: BodyValues = {}
      const change: BodyValues = {}
      for (const { key } of MEASURES) {
        const n = bucket.counts[key]
        if (!n) continue
        values[key] = round1(bucket.sums[key]! / n)
        if (last[key] != null) change[key] = round1(values[key]! - last[key]!)
        last[key] = values[key]
      }
      return { start, label: periodLabel(start, period), count: bucket.count, values, change }
    })
}

/** ค่าล่าสุดที่เคยวัดของแต่ละส่วน ใช้เติมฟอร์มบันทึกครั้งถัดไป */
export function latestValues(rows: BodyMeasurement[]): BodyValues {
  const out: BodyValues = {}
  for (const row of [...rows].sort((a, b) => a.day.localeCompare(b.day))) {
    for (const { key } of MEASURES) if (typeof row[key] === 'number') out[key] = row[key]
  }
  return out
}

export type ParsedMeasurement = { ok: true; values: BodyValues } | { ok: false; error: string }

/**
 * แปลงข้อความจากฟอร์ม (กรอกในหน่วยที่เลือก) เป็นซม./กก. — ช่องว่างคือไม่ได้วัด ต้องมีอย่างน้อยหนึ่งค่า
 * `prefilled` = ค่าเดิมที่เติมไว้ในฟอร์ม ช่องที่ผู้ใช้ไม่ได้แก้จะคงค่าซม.เดิม ไม่ปัดเศษซ้ำจนค่าเลื่อน
 */
export function parseMeasurementInput(input: Partial<Record<MeasureKey, string>>, unit: LengthUnit = 'cm', prefilled: BodyValues = {}): ParsedMeasurement {
  const values: BodyValues = {}
  for (const m of MEASURES) {
    const raw = input[m.key]?.trim().replace(',', '.')
    if (!raw) continue
    const kept = prefilled[m.key]
    if (kept != null && raw === String(toUnit(m.key, kept, unit))) {
      values[m.key] = kept
      continue
    }
    const v = fromUnit(m.key, Number(raw), unit)
    if (!Number.isFinite(v) || v < m.min || v > m.max) {
      return { ok: false, error: `${m.label}ต้องอยู่ระหว่าง ${toUnit(m.key, m.min, unit)}–${toUnit(m.key, m.max, unit)} ${unitLabel(m.key, unit)}` }
    }
    values[m.key] = round1(v)
  }
  if (!Object.keys(values).length) return { ok: false, error: 'กรอกอย่างน้อยหนึ่งค่า' }
  return { ok: true, values }
}

/**
 * นำน้ำหนัก/ส่วนสูงล่าสุดไปใช้กับโปรไฟล์ เป้าแบบ auto คำนวณใหม่ ส่วนเป้าที่ผู้ใช้ตั้งเองห้ามเขียนทับ
 * คืน null ถ้าไม่มีอะไรเปลี่ยน
 */
export function applyToProfile(profile: Profile, values: BodyValues, now = new Date()): Profile | null {
  const weight = values.weight ?? profile.weight
  const height = values.height ?? profile.height
  if (weight === profile.weight && height === profile.height) return null
  const next = { ...profile, weight, height }
  if (profile.targetSource === 'auto') next.target = computeTarget(next, now).target
  return next
}

export const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(n).toFixed(1)}`
