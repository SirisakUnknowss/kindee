import { describe, expect, it } from 'vitest'
import { formatPrice, planCatalog } from './billing'

describe('subscription plans', () => {
  it('contains the four plans in upgrade order', () => {
    expect(planCatalog.map((plan) => plan.id)).toEqual(['free', 'plus', 'pro', 'unlimited'])
  })

  it('formats two-decimal Stripe currencies from minor units', () => {
    const label = formatPrice({ plan: 'plus', interval: 'month', amount: 9900, currency: 'thb' })
    expect(label).toContain('99')
    expect(label).not.toContain('9,900')
  })

  it('does not divide zero-decimal currencies', () => {
    expect(formatPrice({ plan: 'plus', interval: 'month', amount: 900, currency: 'jpy' })).toContain('900')
  })
})
