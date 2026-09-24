import { beforeEach, describe, expect, it, vi } from 'vitest'
import { onRequestGet } from './monitoring'
import type { Env } from '../../_shared/http'

const env = {
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
  SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_test',
  ADMIN_SUPABASE_URL: 'https://admin-project.supabase.co',
  ADMIN_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_admin_test',
  ADMIN_USER_IDS: 'admin-1',
} as Env

const token = (sub = 'admin-1', aal = 'aal2') => `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify({ sub, aal }))}.signature`
const request = (bearer = token()) => new Request('https://kindee.test/api/admin/monitoring', {
  headers: { authorization: `Bearer ${bearer}` },
})
const call = (overrides: Partial<Env> = {}, bearer = token()) => onRequestGet({ request: request(bearer), env: { ...env, ...overrides }, params: {}, waitUntil: () => {} })

beforeEach(() => vi.restoreAllMocks())

describe('GET /api/admin/monitoring', () => {
  it('rejects a request without a valid session', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 401 })))
    expect((await call()).status).toBe(401)
  })

  it('rejects a signed-in non-admin user', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ id: 'user-1', app_metadata: { role: 'member' } })))
    expect((await call()).status).toBe(403)
  })

  it('rejects aal1 even for an allowlisted admin', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ id: 'admin-1' })))
    const response = await call({}, token('admin-1', 'aal1'))
    expect(response.status).toBe(403)
    expect((await response.json() as any).error.code).toBe('mfa_required')
  })

  it('fails closed if admin auth is the user project', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const response = await call({ ADMIN_SUPABASE_URL: env.SUPABASE_URL })
    expect(response.status).toBe(503)
    expect((await response.json() as any).error).toMatchObject({ code: 'admin_unavailable', message: 'ERR_ADMIN_001' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns aggregated data only after separate admin auth, allowlist and MFA', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/auth/v1/user')) {
        expect(url).toBe('https://admin-project.supabase.co/auth/v1/user')
        return Response.json({ id: 'admin-1' })
      }
      if (url.includes('/auth/v1/admin/users')) {
        return Response.json({ users: [{
          id: 'user-1', email: 'ploy@example.com', created_at: '2026-09-19T00:00:00.000Z',
          last_sign_in_at: new Date().toISOString(),
        }] })
      }
      if (init?.method === 'HEAD') {
        return new Response(null, { status: 200, headers: { 'content-range': '0-0/12' } })
      }
      if (url.includes('/rest/v1/entitlements')) {
        return Response.json([{ user_id: 'user-1', plan: 'pro', status: 'active', billing_interval: 'month', period_end: null }])
      }
      if (url.includes('/rest/v1/usage_counters')) {
        return Response.json([{ user_id: 'user-1', feature: 'photo', count: 4, period_start: '2026-09-01' }])
      }
      return Response.json([])
    }))

    const response = await call()
    const body = await response.json() as any

    expect(response.status).toBe(200)
    expect(body.summary.totalUsers).toBe(1)
    expect(body.users[0]).toMatchObject({ email: 'ploy@example.com', plan: 'pro', photosThisMonth: 4 })
    expect(body.funnel).toMatchObject({ signedUp: 1, activated: 0, paid: 1 })
    expect(Array.isArray(body.entrySources)).toBe(true)
    expect(Array.isArray(body.retention)).toBe(true)
  })

  it('computes feature usage, retention and funnel from entry_source data', async () => {
    const now = new Date()
    const recentDay = now.toISOString().slice(0, 10)
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/auth/v1/user')) return Response.json({ id: 'admin-1' })
      if (url.includes('/auth/v1/admin/users')) {
        return Response.json({ users: [
          { id: 'user-1', email: 'ploy@example.com', created_at: now.toISOString(), last_sign_in_at: now.toISOString() },
          { id: 'user-2', email: 'new@example.com', created_at: now.toISOString(), last_sign_in_at: null },
        ] })
      }
      if (init?.method === 'HEAD') return new Response(null, { status: 200, headers: { 'content-range': '0-0/2' } })
      if (url.includes('/rest/v1/entitlements')) return Response.json([])
      if (url.includes('/rest/v1/entries') && url.includes('eaten_on')) {
        return Response.json([
          { user_id: 'user-1', eaten_on: recentDay, updated_at: now.toISOString(), entry_source: 'barcode' },
          { user_id: 'user-1', eaten_on: recentDay, updated_at: now.toISOString(), entry_source: 'photo' },
        ])
      }
      return Response.json([])
    }))

    const body = await (await call()).json() as any

    expect(body.entrySources).toEqual(expect.arrayContaining([
      { source: 'barcode', count: 1 },
      { source: 'photo', count: 1 },
    ]))
    expect(body.funnel).toMatchObject({ signedUp: 2, activated: 1, paid: 0 })
    expect(body.retention[body.retention.length - 1]).toMatchObject({ size: 2 })
    expect(body.retention[body.retention.length - 1].weeks[0]).toBe(50)
  })
})
