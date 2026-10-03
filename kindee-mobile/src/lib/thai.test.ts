import { describe, expect, it } from 'vitest'
import { normalizeThai } from './thai'

describe('normalizeThai', () => {
  it.each([
    ['กระเพรา', 'กะเพรา'],
    ['กะเพรา', 'กะเพรา'],
    ['กระเพา', 'กะเพรา'],
    ['ข้าวมันไก่ต้ม', 'ขาวมันไกตม'],
    [' somtam ', 'somtam'],
    ['นมโฟร์โมสต์', 'นมโฟรโมสต'],
  ])('normalizes %s', (input, expected) => {
    expect(normalizeThai(input)).toBe(expected)
  })

  it('makes common spellings match the canonical food name', () => {
    expect(normalizeThai('ผัดกะเพรา')).toContain(normalizeThai('กระเพา'))
  })

  it('supports prefix matching', () => {
    expect(normalizeThai('ผัดกะเพรา')).toContain(normalizeThai('กะเพ'))
  })
})
