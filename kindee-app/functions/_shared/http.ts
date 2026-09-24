export interface Env {
  APP_ENV?: 'development' | 'staging' | 'production'
  SUPABASE_URL: string
  SUPABASE_PUBLISHABLE_KEY: string
  SUPABASE_SERVICE_ROLE_KEY?: string
  ADMIN_SUPABASE_URL?: string
  ADMIN_SUPABASE_PUBLISHABLE_KEY?: string
  ADMIN_USER_IDS?: string
  GEMINI_API_KEY?: string
  GEMINI_MODEL?: string
  BARCODE_PROVIDER_URL?: string
  APP_URL?: string
  STRIPE_SECRET_KEY?: string
  STRIPE_WEBHOOK_SECRET?: string
  STRIPE_PRICE_PLUS_MONTH?: string
  STRIPE_PRICE_PLUS_YEAR?: string
  STRIPE_PRICE_PRO_MONTH?: string
  STRIPE_PRICE_PRO_YEAR?: string
  STRIPE_PRICE_UNLIMITED_MONTH?: string
  STRIPE_PRICE_UNLIMITED_YEAR?: string
}

export type PagesContext<P extends Record<string, string | string[]> = Record<string, string>> = {
  request: Request
  env: Env
  params: P
  waitUntil(promise: Promise<unknown>): void
}

export const json = (body: unknown, status = 200, headers: HeadersInit = {}) => new Response(
  JSON.stringify(body),
  {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers,
    },
  },
)

export const error = (status: number, code: string, message: string) =>
  json({ error: { code, message } }, status)

export async function authenticatedUser(request: Request, env: Env) {
  const authorization = request.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) return null
  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { authorization, apikey: env.SUPABASE_PUBLISHABLE_KEY },
  })
  if (!response.ok) return null
  return await response.json() as {
    id: string
    email?: string
    app_metadata?: Record<string, unknown>
  }
}

export function supabaseHeaders(env: Env, authorization?: string, privileged = false): HeadersInit {
  const key = privileged ? env.SUPABASE_SERVICE_ROLE_KEY : env.SUPABASE_PUBLISHABLE_KEY
  if (!key) throw new Error('missing_server_secret')
  return {
    apikey: key,
    authorization: authorization ?? `Bearer ${key}`,
    'content-type': 'application/json',
  }
}

export const validBarcode = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{8,14}$/.test(value)
