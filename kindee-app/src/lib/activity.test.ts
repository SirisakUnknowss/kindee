import { describe, expect, it } from 'vitest'
import { clampWater, dailyBudget, defaultWaterGoal, exerciseKcal } from './activity'

describe('water goal', () => {
  it('uses about 30 ml/kg rounded to a 250 ml glass, within 1.5–4 L', () => {
    expect(defaultWaterGoal(60)).toBe(1750)
    expect(defaultWaterGoal(80)).toBe(2500)
    expect(defaultWaterGoal(30)).toBe(1500)
    expect(defaultWaterGoal(200)).toBe(4000)
    expect(defaultWaterGoal(undefined)).toBe(2000)
  })
  it('never goes below zero or above 10 L', () => {
    expect(clampWater(-250)).toBe(0)
    expect(clampWater(12_000)).toBe(10_000)
  })
})

describe('exercise', () => {
  it('estimates kcal as MET × kg × hours', () => {
    expect(exerciseKcal(8.3, 60, 30)).toBe(249)
    expect(exerciseKcal(4.3, 70, 60)).toBe(301)
    expect(exerciseKcal(5, 60, 0)).toBe(0)
  })
  it('only raises the budget in "add" mode', () => {
    expect(dailyBudget(1800, 300, 'included')).toBe(1800)
    expect(dailyBudget(1800, 300, 'add')).toBe(2100)
    expect(dailyBudget(1800, -50, 'add')).toBe(1800)
  })
})
