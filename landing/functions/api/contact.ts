/**
 * Stores a landing-page contact request in public.contact_requests.
 *
 * The landing site is its own Cloudflare Pages project, so this file carries its
 * own small helpers instead of importing kindee-app/functions/_shared.
 * Only the service key can write the table; no client policies exist.
 */

interface Env {
  SUPABASE_URL?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
}

type Context = { request: Request; env: Env }

const TOPICS = new Set(['beta', 'general', 'business', 'support'])
const CONSENT_VERSION = 'contact-2026-09-23'
const MAX_PER_IP_PER_HOUR = 5
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
})
const error = (status: number, code: string, message: string) => json({ error: { code, message } }, status)

const text = (value: unknown, max: number) =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : undefined

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function onRequestPost({ request, env }: Context) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return error(503, 'service_unconfigured', 'Contact form is not configured')
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return error(400, 'invalid_body', 'Expected a JSON body')

  // Bots fill the hidden "website" field; accept silently so they don't retry.
  if (text(body.website, 200)) return json({ ok: true }, 202)

  const name = text(body.name, 80)
  const email = text(body.email, 160)?.toLowerCase()
  const message = text(body.message, 2000)
  const topic = typeof body.topic === 'string' && TOPICS.has(body.topic) ? body.topic : 'general'
  if (!name || !email || !EMAIL.test(email) || !message || message.length < 10) {
    return error(400, 'invalid_contact', 'Name, a valid email and a message of at least 10 characters are required')
  }
  if (body.consent !== true) return error(400, 'consent_required', 'Consent is required to store contact details')

  const headers = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'content-type': 'application/json',
  }

  // Rate limit by a hash of the client IP; the raw address is never stored.
  const ip = request.headers.get('cf-connecting-ip') ?? ''
  const ipHash = ip ? await sha256(`kindee-contact:${ip}`) : null
  if (ipHash) {
    const since = new Date(Date.now() - 60 * 60_000).toISOString()
    const count = await fetch(
      `${env.SUPABASE_URL}/rest/v1/contact_requests?ip_hash=eq.${ipHash}&created_at=gte.${encodeURIComponent(since)}&select=id`,
      { headers: { ...headers, prefer: 'count=exact', range: '0-0' } },
    )
    const total = Number(count.headers.get('content-range')?.split('/')[1] ?? 0)
    if (total >= MAX_PER_IP_PER_HOUR) return error(429, 'too_many_requests', 'Too many messages; try again later')
  }

  const insert = await fetch(`${env.SUPABASE_URL}/rest/v1/contact_requests`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name,
      email,
      topic,
      message,
      consent_version: CONSENT_VERSION,
      ip_hash: ipHash,
      user_agent: text(request.headers.get('user-agent'), 300) ?? null,
    }),
  })
  if (!insert.ok) {
    console.error('contact_insert_failed', insert.status, (await insert.text().catch(() => '')).slice(0, 300))
    return error(503, 'contact_failed', 'The message could not be stored')
  }
  return json({ ok: true }, 202)
}
