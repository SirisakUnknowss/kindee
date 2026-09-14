import { authenticatedUser, error, json, supabaseHeaders, type PagesContext } from '../_shared/http'

type EntryPayload = Record<string, unknown> & {
  client_id?: string
  qty?: number
  kcal?: number
  meal?: string
  eaten_on?: string
  updated_at?: string
}

const meals = new Set(['breakfast', 'lunch', 'dinner', 'snack'])
const sources = new Set(['search', 'recent', 'barcode', 'photo', 'manual'])

function validOperation(value: unknown) {
  if (!value || typeof value !== 'object') return false
  const op = value as { client_id?: unknown; op?: unknown; payload?: EntryPayload }
  const p = op.payload
  if (typeof op.client_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(op.client_id)) return false
  if (!['insert', 'update', 'delete'].includes(String(op.op)) || !p) return false
  if (p.client_id !== op.client_id || !meals.has(String(p.meal))) return false
  if (!sources.has(String(p.entry_source)) || typeof p.food_name !== 'string' || !p.food_name.trim()) return false
  if (!Number.isFinite(p.qty) || Number(p.qty) <= 0 || Number(p.qty) > 100) return false
  if (!Number.isFinite(p.kcal) || Number(p.kcal) < 0 || Number(p.kcal) > 10_000) return false
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(p.eaten_on))) return false
  const eaten = Date.parse(`${p.eaten_on}T00:00:00Z`)
  return eaten >= Date.now() - 366 * 86_400_000 && eaten <= Date.now() + 2 * 86_400_000
}

export async function onRequestPost(context: PagesContext) {
  const { request, env } = context
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
    return error(503, 'service_unconfigured', 'Cloud sync is not configured')
  }
  const user = await authenticatedUser(request, env)
  if (!user) return error(401, 'unauthorized', 'A valid access token is required')

  const body = await request.json().catch(() => null) as {
    installationId?: unknown
    ops?: unknown[]
    since?: unknown
  } | null
  if (!body || typeof body.installationId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.installationId)) {
    return error(400, 'invalid_installation', 'installationId must be a UUID')
  }
  if (!Array.isArray(body.ops) || body.ops.length > 200 || !body.ops.every(validOperation)) {
    return error(400, 'invalid_batch', 'The sync batch is invalid or exceeds 200 operations')
  }
  if (body.since != null && (typeof body.since !== 'string' || !Number.isFinite(Date.parse(body.since)))) {
    return error(400, 'invalid_cursor', 'since must be an ISO timestamp')
  }

  const authorization = request.headers.get('authorization')!
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/sync_entries`, {
    method: 'POST',
    headers: supabaseHeaders(env, authorization),
    body: JSON.stringify({
      p_installation_id: body.installationId,
      p_ops: body.ops,
      p_since: body.since ?? null,
    }),
  })
  if (!response.ok) {
    const detail = await response.text()
    console.error('sync_rpc_failed', response.status, detail.slice(0, 200))
    return error(502, 'sync_failed', 'The server could not reconcile this batch')
  }
  return json(await response.json())
}

export const onRequestGet = () => error(405, 'method_not_allowed', 'Use POST')
