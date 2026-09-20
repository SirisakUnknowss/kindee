import { beforeEach, describe, expect, it } from 'vitest'
import { buildReportBody, resetReportThrottle, shouldSend } from './report'

beforeEach(() => {
  resetReportThrottle()
})

describe('shouldSend', () => {
  it('sends the first occurrence of an error', () => {
    expect(shouldSend('error:boom')).toBe(true)
  })

  it('drops the same error repeating within a minute', () => {
    const now = Date.now()
    expect(shouldSend('error:boom', now)).toBe(true)
    expect(shouldSend('error:boom', now + 5_000)).toBe(false)
  })

  it('sends it again once the window has passed', () => {
    const now = Date.now()
    shouldSend('error:boom', now)
    expect(shouldSend('error:boom', now + 61_000)).toBe(true)
  })

  it('keeps different errors independent', () => {
    expect(shouldSend('error:a')).toBe(true)
    expect(shouldSend('error:b')).toBe(true)
  })

  it('stops after twenty reports so one session cannot flood the table', () => {
    for (let i = 0; i < 20; i += 1) expect(shouldSend(`error:${i}`)).toBe(true)
    expect(shouldSend('error:21')).toBe(false)
  })
})

describe('buildReportBody', () => {
  it('trims the message and stack to what the API accepts', () => {
    const body = buildReportBody(
      { kind: 'error', message: `  ${'x'.repeat(900)}  `, detail: 'y'.repeat(9_000) },
      {},
    )

    expect(body.message).toHaveLength(500)
    expect(body.detail).toHaveLength(4_000)
  })

  it('keeps a rating only on feedback', () => {
    expect(buildReportBody({ kind: 'feedback', message: 'ดีมาก', rating: 5 }, {}).rating).toBe(5)
    expect(buildReportBody({ kind: 'error', message: 'boom', rating: 5 }, {}).rating).toBeUndefined()
  })

  it('drops a rating that is not a whole number', () => {
    expect(buildReportBody({ kind: 'feedback', message: 'ok', rating: 4.5 }, {}).rating).toBeUndefined()
  })

  it('carries the device and version context used to group reports', () => {
    const body = buildReportBody(
      { kind: 'feedback', message: 'หาเมนูไม่เจอ' },
      { installationId: 'device-1', url: 'https://kindee.pages.dev/', appVersion: 'production' },
    )

    expect(body).toMatchObject({
      kind: 'feedback',
      installationId: 'device-1',
      url: 'https://kindee.pages.dev/',
      appVersion: 'production',
    })
  })
})
