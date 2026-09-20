import { beforeEach, describe, expect, it, vi } from 'vitest'
import { onRequestGet } from './monitoring'
import type { Env } from '../../_shared/http'

const env = {
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
  SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_test',
} as Env

const request = () => new Request('https://kindee.test/api/admin/monitoring', {
  headers: { authorization: 'Bearer user-token' },
})
const call = () => onRequestGet({ request: request(), env, params: {}, waitUntil: () => {} })

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

  it('returns aggregated data only after app_metadata admin authorization', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/auth/v1/user')) {
        return Response.json({ id: 'admin-1', app_metadata: { role: 'admin' } })
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
  })
})
