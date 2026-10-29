import { describe, expect, it } from 'vitest'
import { missingNutrients, nutrientStatus, nutrientTargets } from './nutrients'
import type { Entry } from './types'
import { entryMacros } from './calc'

describe('daily nutrient plans', () => {
  it('uses logged snapshots for products outside the bundled catalogue', () => {
    expect(entryMacros({ foodId: 'external-product', entrySource: 'barcode', protein: 15, carb: 25, fat: 4 } as Entry)).toEqual({ protein: 15, carb: 25, fat: 4 })
  })
  it('allocates the calorie budget and scales protein with weight', () => {
    const plan = nutrientTargets({ weight: 70, target: 2400 }, true)!
    expect(plan.protein).toBeCloseTo(112)
    expect(plan.fat).toBeCloseTo(80)
    expect(plan.carb).toBeCloseTo(308)
    expect(plan.protein * 4 + plan.carb * 4 + plan.fat * 9).toBeCloseTo(2400)
  })
  it('keeps general protein at least 10% energy and 0.8 g/kg', () => {
    expect(nutrientTargets({ weight: 70, target: 2400 }, false)?.protein).toBe(60)
    expect(nutrientTargets({ weight: 90, target: 2400 }, false)?.protein).toBe(72)
  })
  it('rejects invalid or incompatible budgets instead of negative carbs', () => {
    for (const weight of [0, -10, NaN, Infinity]) expect(nutrientTargets({ weight, target: 2400 }, true)).toBeNull()
    expect(nutrientTargets({ weight: 150, target: 1200 }, true)).toBeNull()
    expect(nutrientTargets({ weight: 70, target: 0 }, false)).toBeNull()
  })
  it('distinguishes missing nutrients from explicit zero', () => {
    const entry = { protein: 0, carb: 0, fat: 0 } as Entry
    expect(missingNutrients([entry])).toBe(0)
    expect(missingNutrients([entry, { ...entry, protein: undefined }])).toBe(1)
  })
  it('handles protein met and over-budget carbs without negative remaining', () => {
    expect(nutrientStatus(120, 112, true)).toBe('ถึงเป้าที่วางไว้แล้ว')
    expect(nutrientStatus(320, 308, false)).toBe('เกินงบที่วางไว้ 12 ก.')
  })
})
