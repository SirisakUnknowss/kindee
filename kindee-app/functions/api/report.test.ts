import { beforeEach, describe, expect, it, vi } from 'vitest'
import { onRequestPost } from './report'
import type { Env } from '../_shared/http'

const env = {
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
  SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_test',
} as Env

const post = (body: unknown, headers: Record<string, string> = {}) => new Request('https://kindee.test/api/report', {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...headers },
  body: JSON.stringify(body),
})

const okInsert = () => new Response('', { status: 201 })
const countResponse = (total: number) =>
  new Response('[]', { status: 200, headers: { 'content-range': `0-0/${total}` } })

const call = (request: Request, overrides: Partial<Env> = {}) =>
  onRequestPost({ request, env: { ...env, ...overrides } as Env, params: {}, waitUntil: () => {} })

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('POST /api/report', () => {
  it('rejects a body without a usable kind or message', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const response = await call(post({ kind: 'nonsense', message: 'x' }))
    expect(response.status).toBe(400)
    expect((await response.json() as any).error.code).toBe('invalid_report')
  })

  it('rejects a message that is only whitespace', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const response = await call(post({ kind: 'feedback', message: '   ' }))
    expect(response.status).toBe(400)
  })

  it('refuses to run without a service key rather than dropping reports silently', async () => {
    const response = await call(post({ kind: 'error', message: 'boom' }), { SUPABASE_SERVICE_ROLE_KEY: undefined })
    expect(response.status).toBe(503)
    expect((await response.json() as any).error.code).toBe('service_unconfigured')
  })

  it('stores a guest error report with no user attached', async () => {
    let inserted: any = null
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      if (url.includes('/auth/v1/user')) return new Response('', { status: 401 })
      if (init?.method === 'POST') {
        inserted = JSON.parse(String(init.body))
        return okInsert()
      }
      return countResponse(0)
    }))

    const response = await call(post({ kind: 'error', message: 'TypeError: x is not a function', detail: 'stack' }))

    expect(response.status).toBe(202)
    expect(inserted).toMatchObject({ kind: 'error', user_id: null, message: 'TypeError: x is not a function' })
  })

  it('attaches the signed-in user when a token is sent', async () => {
    let inserted: any = null
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      if (url.includes('/auth/v1/user')) return new Response(JSON.stringify({ id: 'user-1' }), { status: 200 })
      if (init?.method === 'POST') {
        inserted = JSON.parse(String(init.body))
        return okInsert()
      }
      return countResponse(0)
    }))

    await call(post({ kind: 'feedback', message: 'หาเมนูไม่เจอ', rating: 4 }, { authorization: 'Bearer token' }))

    expect(inserted).toMatchObject({ user_id: 'user-1', rating: 4, kind: 'feedback' })
  })

  it('keeps a rating only for feedback and only when it is 1-5', async () => {
    const insertedBodies: any[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      if (url.includes('/auth/v1/user')) return new Response('', { status: 401 })
      if (init?.method === 'POST') {
        insertedBodies.push(JSON.parse(String(init.body)))
        return okInsert()
      }
      return countResponse(0)
    }))

    await call(post({ kind: 'feedback', message: 'a', rating: 9 }))
    await call(post({ kind: 'error', message: 'b', rating: 5 }))

    expect(insertedBodies[0].rating).toBeNull()
    expect(insertedBodies[1].rating).toBeNull()
  })

  it('truncates an oversized stack instead of failing the request', async () => {
    let inserted: any = null
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      if (url.includes('/auth/v1/user')) return new Response('', { status: 401 })
      if (init?.method === 'POST') {
        inserted = JSON.parse(String(init.body))
        return okInsert()
      }
      return countResponse(0)
    }))

    await call(post({ kind: 'error', message: 'x'.repeat(900), detail: 'y'.repeat(9_000) }))

    expect(inserted.message).toHaveLength(500)
    expect(inserted.detail).toHaveLength(4_000)
  })

  it('stops a device that is already flooding the table', async () => {
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      if (url.includes('/auth/v1/user')) return new Response('', { status: 401 })
      return countResponse(60)
    })
    vi.stubGlobal('fetch', fetchMock)

    const response = await call(post({ kind: 'error', message: 'loop', installationId: 'device-1' }))

    expect(response.status).toBe(429)
    expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit)?.method === 'POST')).toBe(false)
  })

  it('reports a storage failure instead of pretending it worked', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      if (url.includes('/auth/v1/user')) return new Response('', { status: 401 })
      if (init?.method === 'POST') return new Response('db down', { status: 500 })
      return countResponse(0)
    }))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const response = await call(post({ kind: 'error', message: 'boom' }))

    expect(response.status).toBe(503)
    expect((await response.json() as any).error.code).toBe('report_failed')
  })
})
