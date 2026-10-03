import { describe, expect, it } from 'vitest'
import { ageFrom, computeTarget, floorFor, mealForHour } from './calc'
import type { Profile } from './types'

const profile: Profile = {
  sex: 'female', bDay: 15, bMonth: 6, bYear: 1996,
  height: 160, weight: 55, activity: 'moderate', goal: 'keep',
  target: 0, targetSource: 'auto',
}

describe('TDEE calculations', () => {
  it('calculates age around the birthday boundary', () => {
    expect(ageFrom(15, 6, 1996, new Date('2026-06-14T12:00:00Z'))).toBe(29)
    expect(ageFrom(15, 6, 1996, new Date('2026-06-15T12:00:00Z'))).toBe(30)
  })

  it('never recommends below the supportive lower limit', () => {
    const result = computeTarget({ ...profile, weight: 20, height: 100, activity: 'sedentary', goal: 'lose' }, new Date('2026-09-14'))
    expect(result.target).toBe(floorFor('female'))
    expect(result.floored).toBe(true)
  })

  it('maps hour boundaries to meal slots', () => {
    expect([mealForHour(9), mealForHour(10), mealForHour(15), mealForHour(21)])
      .toEqual(['breakfast', 'lunch', 'dinner', 'snack'])
  })
})
