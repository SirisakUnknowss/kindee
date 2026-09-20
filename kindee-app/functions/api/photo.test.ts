import { beforeEach, describe, expect, it, vi } from 'vitest'
import { onRequestPost } from './photo'
import type { Env } from '../_shared/http'

const CONSENT_VERSION = 'photo-ai-2026-09-15'
// 1x1 transparent PNG.
const IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

const env = {
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
  SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_test',
  GEMINI_API_KEY: 'gemini-test',
  GEMINI_MODEL: 'gemini-3.6-flash',
} as Env

const freshConsent = () => ({
  version: CONSENT_VERSION,
  provider: 'Google Gemini API',
  consentedAt: new Date().toISOString(),
})

const post = (body: unknown) => new Request('https://kindee.test/api/photo', {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: 'Bearer token' },
  body: JSON.stringify(body),
})

const call = (request: Request, overrides: Partial<Env> = {}) =>
  onRequestPost({ request, env: { ...env, ...overrides } as Env, params: {}, waitUntil: () => {} })

const food = {
  id: 'food-1',
  name_th: 'ลาเต้เย็น',
  kcal_100g: 47.5,
  protein_100g: 2.25,
  carb_100g: 4.5,
  fat_100g: 2.25,
  serving_size_g: 400,
}

/** Routes each Supabase/Gemini call a happy-path handler would make. */
const stubBackend = (options: {
  usage?: number
  plan?: { plan: string; status: string }
  cached?: unknown[]
  consentOk?: boolean
  picks?: unknown
  geminiOk?: boolean
  catalogue?: unknown[]
} = {}) => {
  const calls: { url: string; init?: RequestInit }[] = []
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    if (url.includes('/auth/v1/user')) return new Response(JSON.stringify({ id: 'user-1' }), { status: 200 })
    if (url.includes('privacy_consents')) {
      return new Response('', { status: options.consentOk === false ? 400 : 201 })
    }
    if (url.includes('photo_jobs') && init?.method === 'DELETE') return new Response(null, { status: 204 })
    if (url.includes('photo_jobs') && (!init?.method || init.method === 'GET')) {
      return new Response(JSON.stringify(options.cached ?? []), { status: 200 })
    }
    if (url.includes('entitlements')) {
      return new Response(JSON.stringify(options.plan ? [options.plan] : []), { status: 200 })
    }
    if (url.includes('usage_counters') && (!init?.method || init.method === 'GET')) {
      return new Response(JSON.stringify(options.usage ? [{ count: options.usage }] : []), { status: 200 })
    }
    if (url.includes('/rest/v1/foods')) {
      return new Response(JSON.stringify(options.catalogue ?? [food]), { status: 200 })
    }
    if (url.includes('generativelanguage.googleapis.com')) {
      if (options.geminiOk === false) return new Response('{"error":{"code":404}}', { status: 404 })
      return new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: JSON.stringify(options.picks ?? [{ i: 0, confidence: 0.9, portion: 1 }]) }] } }],
      }), { status: 200 })
    }
    return new Response('', { status: 201 })
  })
  vi.stubGlobal('fetch', fetchMock)
  return { fetchMock, calls }
}

const geminiWasCalled = (calls: { url: string }[]) =>
  calls.some((c) => c.url.includes('generativelanguage.googleapis.com'))

beforeEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('POST /api/photo consent gate', () => {
  it('refuses a request with no consent block and never calls the provider', async () => {
    const { calls } = stubBackend()
    const response = await call(post({ imageBase64: IMAGE }))

    expect(response.status).toBe(400)
    expect((await response.json() as any).error.code).toBe('consent_required')
    expect(geminiWasCalled(calls)).toBe(false)
  })

  it('refuses consent recorded for a different provider', async () => {
    const { calls } = stubBackend()
    const response = await call(post({
      imageBase64: IMAGE,
      consent: { ...freshConsent(), provider: 'Another AI' },
    }))

    expect(response.status).toBe(400)
    expect(geminiWasCalled(calls)).toBe(false)
  })

  it('refuses a stale consent timestamp', async () => {
    const { calls } = stubBackend()
    const response = await call(post({
      imageBase64: IMAGE,
      consent: { ...freshConsent(), consentedAt: new Date(Date.now() - 30 * 60_000).toISOString() },
    }))

    expect(response.status).toBe(400)
    expect(geminiWasCalled(calls)).toBe(false)
  })

  it('does not send the photo when the consent record cannot be stored', async () => {
    const { calls } = stubBackend({ consentOk: false })
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const response = await call(post({ imageBase64: IMAGE, consent: freshConsent() }))

    expect(response.status).toBe(503)
    expect((await response.json() as any).error.code).toBe('consent_audit_failed')
    expect(geminiWasCalled(calls)).toBe(false)
  })
})

describe('POST /api/photo quota and configuration', () => {
  it('requires a signed-in user', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 401 })))
    const response = await call(post({ imageBase64: IMAGE, consent: freshConsent() }))
    expect(response.status).toBe(401)
  })

  it('stops a free user at three photos a month', async () => {
    const { calls } = stubBackend({ usage: 3 })
    const response = await call(post({ imageBase64: IMAGE, consent: freshConsent() }))

    expect(response.status).toBe(402)
    expect((await response.json() as any).error.code).toBe('quota_exhausted')
    expect(geminiWasCalled(calls)).toBe(false)
  })

  it('lets an active Plus user past the free limit', async () => {
    const { calls } = stubBackend({ usage: 3, plan: { plan: 'plus', status: 'active' } })
    const response = await call(post({ imageBase64: IMAGE, consent: freshConsent() }))

    expect(response.status).toBe(200)
    expect(geminiWasCalled(calls)).toBe(true)
  })

  it('does not treat a cancelled Plus plan as paid', async () => {
    const { calls } = stubBackend({ usage: 3, plan: { plan: 'plus', status: 'cancelled' } })
    const response = await call(post({ imageBase64: IMAGE, consent: freshConsent() }))

    expect(response.status).toBe(402)
    expect(geminiWasCalled(calls)).toBe(false)
  })

  it('rejects a payload that is not a supported image', async () => {
    stubBackend()
    const response = await call(post({ imageBase64: 'data:text/html;base64,AAAA', consent: freshConsent() }))
    expect(response.status).toBe(413)
  })

  it('serves a cached result without calling the provider again', async () => {
    const cached = [{ candidates: [{ food_id: 'food-1', name_th: 'ลาเต้เย็น', kcal: 190 }] }]
    const { calls } = stubBackend({ cached })

    const response = await call(post({ imageBase64: IMAGE, consent: freshConsent() }))
    const body = await response.json() as any

    expect(body.source).toBe('cache')
    expect(geminiWasCalled(calls)).toBe(false)
  })
})

describe('POST /api/photo results', () => {
  it('computes nutrition for one serving from the catalogue, not from the model', async () => {
    stubBackend()
    const response = await call(post({ imageBase64: IMAGE, consent: freshConsent() }))
    const body = await response.json() as any

    expect(body.candidates).toHaveLength(1)
    expect(body.candidates[0]).toMatchObject({
      food_id: 'food-1',
      name_th: 'ลาเต้เย็น',
      serving_g: 400,
      kcal: 190,
      protein: 9,
      carb: 18,
      fat: 9,
    })
  })

  it('clamps a wild portion estimate to a quarter step in range', async () => {
    stubBackend({ picks: [{ i: 0, confidence: 2, portion: 99 }] })
    const body = await (await call(post({ imageBase64: IMAGE, consent: freshConsent() }))).json() as any

    expect(body.candidates[0].portion).toBe(4)
    expect(body.candidates[0].confidence).toBe(1)
  })

  it('drops an index the model invented', async () => {
    stubBackend({ picks: [{ i: 42, confidence: 0.9 }] })
    const response = await call(post({ imageBase64: IMAGE, consent: freshConsent() }))

    expect(response.status).toBe(422)
    expect((await response.json() as any).error.code).toBe('no_match')
  })

  it('does not return the same food twice', async () => {
    stubBackend({ picks: [{ i: 0, confidence: 0.9 }, { i: 0, confidence: 0.5 }] })
    const body = await (await call(post({ imageBase64: IMAGE, consent: freshConsent() }))).json() as any

    expect(body.candidates).toHaveLength(1)
  })

  it('surfaces a provider outage as provider_failed', async () => {
    stubBackend({ geminiOk: false })
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const response = await call(post({ imageBase64: IMAGE, consent: freshConsent() }))

    expect(response.status).toBe(502)
    expect((await response.json() as any).error.code).toBe('provider_failed')
  })

  it('rejects a non-JSON answer from the provider', async () => {
    stubBackend({ picks: 'not json at all' })
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/auth/v1/user')) return new Response(JSON.stringify({ id: 'user-1' }), { status: 200 })
      if (url.includes('privacy_consents')) return new Response('', { status: 201 })
      if (url.includes('photo_jobs') && init?.method === 'DELETE') return new Response(null, { status: 204 })
      if (url.includes('photo_jobs')) return new Response('[]', { status: 200 })
      if (url.includes('entitlements') || url.includes('usage_counters')) return new Response('[]', { status: 200 })
      if (url.includes('/rest/v1/foods')) return new Response(JSON.stringify([food]), { status: 200 })
      if (url.includes('generativelanguage')) {
        return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'สวัสดีครับ' }] } }] }), { status: 200 })
      }
      return new Response('', { status: 201 })
    }))

    const response = await call(post({ imageBase64: IMAGE, consent: freshConsent() }))

    expect(response.status).toBe(502)
    expect((await response.json() as any).error.code).toBe('invalid_provider_result')
  })

  it('fails closed when the catalogue is empty', async () => {
    stubBackend({ catalogue: [] })
    const response = await call(post({ imageBase64: IMAGE, consent: freshConsent() }))

    expect(response.status).toBe(503)
    expect((await response.json() as any).error.code).toBe('catalogue_empty')
  })
})
