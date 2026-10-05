import { beforeEach, describe, expect, it, vi } from 'vitest'
import { onRequestDelete } from './account'
import type { Env } from '../_shared/http'

const env = {
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
  SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_test',
} as Env

const USER = '11111111-1111-4111-8111-111111111111'
const INSTALLATION = '22222222-2222-4222-8222-222222222222'

const call = () => onRequestDelete({
  request: new Request('https://kindee.test/api/account', { method: 'DELETE', headers: { authorization: 'Bearer token' } }),
  env,
  params: {},
  waitUntil: () => {},
})

/** Routes each Supabase call to a canned response and records the request. */
function stubSupabase(overrides: { installations?: Response; reports?: Response; user?: Response } = {}) {
  const calls: { url: string; method: string }[] = []
  vi.stubGlobal('fetch', vi.fn(async (input: string, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? 'GET'
    calls.push({ url, method })
    if (url.includes('/auth/v1/user')) return Response.json({ id: USER })
    if (url.includes('/rest/v1/installations')) return overrides.installations ?? Response.json([{ installation_id: INSTALLATION }])
    if (url.includes('/rest/v1/app_reports')) return overrides.reports ?? new Response(null, { status: 204 })
    if (url.includes('/auth/v1/admin/users/')) return overrides.user ?? new Response('', { status: 200 })
    return new Response('unexpected', { status: 500 })
  }))
  return calls
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('DELETE /api/account', () => {
  it('deletes the user\'s reports (by user id and by claimed installation) before the account', async () => {
    const calls = stubSupabase()
    const response = await call()
    expect(response.status).toBe(200)

    const reportDelete = calls.findIndex((c) => c.method === 'DELETE' && c.url.includes('/rest/v1/app_reports'))
    const userDelete = calls.findIndex((c) => c.method === 'DELETE' && c.url.includes('/auth/v1/admin/users/'))
    expect(reportDelete).toBeGreaterThan(-1)
    expect(userDelete).toBeGreaterThan(reportDelete)
    const url = decodeURIComponent(calls[reportDelete].url)
    expect(url).toContain(`user_id.eq.${USER}`)
    expect(url).toContain(`installation_id.in.(${INSTALLATION})`)
  })

  it('still removes reports attributed to the user when no installation was claimed', async () => {
    const calls = stubSupabase({ installations: Response.json([]) })
    await call()
    const reportDelete = calls.find((c) => c.method === 'DELETE' && c.url.includes('/rest/v1/app_reports'))!
    const url = decodeURIComponent(reportDelete.url)
    expect(url).toContain(`user_id.eq.${USER}`)
    expect(url).not.toContain('installation_id.in')
  })

  it('leaves the account untouched when the reports cannot be deleted', async () => {
    const calls = stubSupabase({ reports: new Response('boom', { status: 500 }) })
    const response = await call()
    expect(response.status).toBe(502)
    expect(calls.some((c) => c.url.includes('/auth/v1/admin/users/'))).toBe(false)
  })

  it('rejects an unauthenticated request', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 401 })))
    const response = await call()
    expect(response.status).toBe(401)
  })
})
