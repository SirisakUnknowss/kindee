import { describe, expect, it } from 'vitest'
import { aggregate, applyToProfile, latestValues, parseMeasurementInput, periodLabel, periodStart, signed, toUnit, unitLabel, type BodyMeasurement } from './body'
import type { Profile } from './types'

const m = (day: string, values: Partial<BodyMeasurement>): BodyMeasurement => ({ day, updatedAt: `${day}T08:00:00Z`, ...values })

describe('body measurement periods', () => {
  it('starts weeks on Monday and months on the 1st', () => {
    expect(periodStart('2024-01-03', 'day')).toBe('2024-01-03')
    expect(periodStart('2024-01-07', 'week')).toBe('2024-01-01')
    expect(periodStart('2024-01-08', 'week')).toBe('2024-01-08')
    expect(periodStart('2023-12-31', 'week')).toBe('2023-12-25')
    expect(periodStart('2024-02-29', 'month')).toBe('2024-02-01')
  })
  it('labels periods in Thai with Buddhist-era month labels', () => {
    expect(periodLabel('2024-01-01', 'week')).toBe('1–7 ม.ค.')
    expect(periodLabel('2024-01-29', 'week')).toBe('29 ม.ค. – 4 ก.พ.')
    expect(periodLabel('2024-02-01', 'month')).toBe('ก.พ. 67')
  })
})

describe('aggregate', () => {
  const rows = [
    m('2024-01-01', { weight: 70, waist: 80 }),
    m('2024-01-03', { weight: 69 }),
    m('2024-01-09', { weight: 68.4, waist: 78.5 }),
    m('2024-02-05', { weight: 67, hip: 95 }),
  ]

  it('keeps one row per measured day with change from the previous day', () => {
    const daily = aggregate(rows, 'day')
    expect(daily.map((r) => r.start)).toEqual(['2024-01-01', '2024-01-03', '2024-01-09', '2024-02-05'])
    expect(daily[1].change).toEqual({ weight: -1 })
    // waist was not measured on Jan 3, so Jan 9 compares with Jan 1
    expect(daily[2].change).toEqual({ weight: -0.6, waist: -1.5 })
    expect(daily[3].change).toEqual({ weight: -1.4 })
  })

  it('averages only measured values per week and month', () => {
    const weekly = aggregate(rows, 'week')
    expect(weekly).toHaveLength(3)
    expect(weekly[0]).toMatchObject({ start: '2024-01-01', count: 2, values: { weight: 69.5, waist: 80 }, change: {} })
    expect(weekly[1]).toMatchObject({ start: '2024-01-08', values: { weight: 68.4, waist: 78.5 }, change: { weight: -1.1, waist: -1.5 } })
    const monthly = aggregate(rows, 'month')
    expect(monthly.map((r) => r.values.weight)).toEqual([69.1, 67])
    expect(monthly[1].change).toEqual({ weight: -2.1 })
    expect(monthly[1].values.hip).toBe(95)
  })

  it('sorts input, skips empty or invalid rows and never treats missing as zero', () => {
    const out = aggregate([m('2024-03-02', { weight: 60 }), m('bad', { weight: 1 }), m('2024-03-01', {}), m('2024-03-01', { calf: 35 })], 'day')
    expect(out.map((r) => r.start)).toEqual(['2024-03-01', '2024-03-02'])
    expect(out[1].change).toEqual({})
    expect(aggregate([], 'month')).toEqual([])
  })

  it('returns the latest known value of each measure', () => {
    expect(latestValues([rows[2], rows[0], rows[3]])).toEqual({ weight: 67, waist: 78.5, hip: 95 })
  })
})

describe('measurement input', () => {
  it('parses filled fields and ignores blanks', () => {
    expect(parseMeasurementInput({ weight: ' 65,45 ', waist: '', calf: '36' })).toEqual({ ok: true, values: { weight: 65.5, calf: 36 } })
  })
  it('rejects out-of-range values and empty forms', () => {
    expect(parseMeasurementInput({ waist: '5' })).toEqual({ ok: false, error: 'รอบเอวต้องอยู่ระหว่าง 30–250 ซม.' })
    expect(parseMeasurementInput({ weight: 'abc' }).ok).toBe(false)
    expect(parseMeasurementInput({})).toEqual({ ok: false, error: 'กรอกอย่างน้อยหนึ่งค่า' })
  })
  it('accepts inches and stores centimetres, keeping weight in kg', () => {
    expect(parseMeasurementInput({ waist: '32', weight: '70', height: '64.5' }, 'in')).toEqual({ ok: true, values: { waist: 81.3, weight: 70, height: 163.8 } })
    expect(parseMeasurementInput({ waist: '5' }, 'in')).toEqual({ ok: false, error: 'รอบเอวต้องอยู่ระหว่าง 11.8–98.4 นิ้ว' })
  })
  it('keeps untouched prefilled values exactly instead of re-rounding through inches', () => {
    expect(parseMeasurementInput({ height: '63.8', waist: '33' }, 'in', { height: 162, waist: 81.3 })).toEqual({ ok: true, values: { height: 162, waist: 83.8 } })
  })
  it('converts stored values and changes for display', () => {
    expect(toUnit('waist', 81.3, 'in')).toBe(32)
    expect(toUnit('waist', -2.54, 'in')).toBe(-1)
    expect(toUnit('weight', 70, 'in')).toBe(70)
    expect(toUnit('hip', 95, 'cm')).toBe(95)
    expect([unitLabel('calf', 'in'), unitLabel('calf', 'cm'), unitLabel('weight', 'in')]).toEqual(['นิ้ว', 'ซม.', 'กก.'])
  })
  it('formats signed changes', () => {
    expect(signed(-1.25)).toBe('−1.3')
    expect(signed(0.5)).toBe('+0.5')
    expect(signed(0)).toBe('±0.0')
  })
})

describe('applyToProfile', () => {
  const profile: Profile = {
    sex: 'female', bDay: 1, bMonth: 1, bYear: 1990, height: 160, weight: 60,
    activity: 'light', goal: 'lose', target: 1500, targetSource: 'auto',
  }
  const now = new Date(2024, 5, 1)

  it('recomputes an automatic target from the new weight', () => {
    const next = applyToProfile(profile, { weight: 58 }, now)!
    expect(next.weight).toBe(58)
    expect(next.target).not.toBe(1500)
    expect(next.target % 10).toBe(0)
  })
  it('never overwrites a manual target', () => {
    const next = applyToProfile({ ...profile, targetSource: 'manual', target: 1700 }, { weight: 58, height: 161 }, now)!
    expect(next).toMatchObject({ weight: 58, height: 161, target: 1700 })
  })
  it('returns null when weight and height are unchanged or absent', () => {
    expect(applyToProfile(profile, { waist: 70 }, now)).toBeNull()
    expect(applyToProfile(profile, { weight: 60, height: 160 }, now)).toBeNull()
  })
})
