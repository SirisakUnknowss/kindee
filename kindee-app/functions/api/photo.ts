import { authenticatedUser, error, json, supabaseHeaders, type PagesContext } from '../_shared/http'

const PHOTO_AI_CONSENT_VERSION = 'photo-ai-2026-09-15'

const decodeImage = (dataUrl: string) => {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl)
  if (!match || match[2].length > 2_700_000) return null
  const binary = atob(match[2])
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return { mimeType: match[1], base64: match[2], bytes }
}

const sha256 = async (bytes: Uint8Array) => {
  const digest = await crypto.subtle.digest('SHA-256', bytes.buffer as ArrayBuffer)
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('')
}

export async function onRequestPost({ request, env }: PagesContext) {
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return error(503, 'service_unconfigured', 'Photo analysis is not configured')
  }
  const user = await authenticatedUser(request, env)
  if (!user) return error(401, 'unauthorized', 'A free account is required')
  if (!env.GEMINI_API_KEY) return error(503, 'feature_unavailable', 'Photo analysis is not enabled')

  const body = await request.json().catch(() => null) as {
    imageBase64?: unknown
    consent?: { version?: unknown; provider?: unknown; consentedAt?: unknown }
  } | null
  const consentedAt = typeof body?.consent?.consentedAt === 'string' ? new Date(body.consent.consentedAt) : null
  const consentIsFresh = consentedAt && Number.isFinite(consentedAt.getTime()) &&
    Math.abs(Date.now() - consentedAt.getTime()) <= 10 * 60 * 1000
  if (
    body?.consent?.version !== PHOTO_AI_CONSENT_VERSION ||
    body?.consent?.provider !== 'Google Gemini API' ||
    !consentIsFresh
  ) {
    return error(400, 'consent_required', 'Explicit, current consent is required before sending a photo to the AI provider')
  }
  const image = typeof body?.imageBase64 === 'string' ? decodeImage(body.imageBase64) : null
  if (!image) return error(413, 'invalid_image', 'Use a JPEG, PNG, or WebP image no larger than 2 MB')
  const imageHash = await sha256(image.bytes)
  const adminHeaders = supabaseHeaders(env, undefined, true)

  // Record consent before any possible transfer to the AI provider. If this
  // cannot be evidenced, fail closed and do not send the image.
  const consentResponse = await fetch(`${env.SUPABASE_URL}/rest/v1/privacy_consents?on_conflict=user_id,purpose,version`, {
    method: 'POST', headers: { ...adminHeaders, prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({
      user_id: user.id,
      purpose: 'photo_ai_analysis',
      version: PHOTO_AI_CONSENT_VERSION,
      provider: 'Google Gemini API',
      granted_at: consentedAt!.toISOString(),
      withdrawn_at: null,
    }),
  })
  if (!consentResponse.ok) return error(503, 'consent_audit_failed', 'Consent could not be recorded; the photo was not sent')

  // Opportunistic retention enforcement; raw images are never stored by KinDee.
  await fetch(`${env.SUPABASE_URL}/rest/v1/photo_jobs?expires_at=lt.${encodeURIComponent(new Date().toISOString())}`, {
    method: 'DELETE', headers: adminHeaders,
  })

  const cachedResponse = await fetch(
    `${env.SUPABASE_URL}/rest/v1/photo_jobs?user_id=eq.${user.id}&image_hash=eq.${imageHash}&status=eq.complete&select=candidates&limit=1`,
    { headers: adminHeaders },
  )
  if (cachedResponse.ok) {
    const cached = await cachedResponse.json() as Array<{ candidates: unknown }>
    if (cached[0]) return json({ source: 'cache', candidates: cached[0].candidates })
  }

  const monthStart = new Date().toISOString().slice(0, 7) + '-01'
  const [entitlementResponse, usageResponse] = await Promise.all([
    fetch(`${env.SUPABASE_URL}/rest/v1/entitlements?user_id=eq.${user.id}&select=plan,status&limit=1`, { headers: adminHeaders }),
    fetch(`${env.SUPABASE_URL}/rest/v1/usage_counters?user_id=eq.${user.id}&feature=eq.photo&period_start=eq.${monthStart}&select=count&limit=1`, { headers: adminHeaders }),
  ])
  const entitlement = entitlementResponse.ok ? (await entitlementResponse.json() as Array<{ plan: string; status: string }>)[0] : null
  const usage = usageResponse.ok ? (await usageResponse.json() as Array<{ count: number }>)[0]?.count ?? 0 : 0
  const limit = entitlement?.plan === 'premium' && ['active', 'trialing'].includes(entitlement.status) ? 30 : 3
  if (usage >= limit) return error(402, 'quota_exhausted', `Monthly photo quota of ${limit} has been used`)

  const catalogueResponse = await fetch(
    `${env.SUPABASE_URL}/rest/v1/foods?is_public=eq.true&quality=in.(verified,community)&select=id,name_th,kcal_100g,protein_100g,carb_100g,fat_100g&order=popularity.desc&limit=120`,
    { headers: adminHeaders },
  )
  const catalogue = catalogueResponse.ok ? await catalogueResponse.json() as Array<Record<string, unknown>> : []
  if (!catalogue.length) return error(503, 'catalogue_empty', 'No verified foods are available for matching')

  const model = env.GEMINI_MODEL ?? 'gemini-2.5-flash'
  const aiResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [
          { text: `เลือกอาหารที่ตรงกับรูปมากที่สุดไม่เกิน 3 รายการจาก JSON นี้เท่านั้น: ${JSON.stringify(catalogue)} ตอบเป็น JSON array ที่มี food_id และ confidence 0..1 ห้ามสร้างรายการใหม่` },
          { inlineData: { mimeType: image.mimeType, data: image.base64 } },
        ] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
      }),
    },
  )
  if (!aiResponse.ok) return error(502, 'provider_failed', 'The image provider could not analyze this photo')
  const aiResult = await aiResponse.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
  const text = aiResult.candidates?.[0]?.content?.parts?.[0]?.text
  let picks: Array<{ food_id: string; confidence: number }>
  try { picks = JSON.parse(text ?? '[]') } catch { return error(502, 'invalid_provider_result', 'The provider returned an invalid result') }
  const byId = new Map(catalogue.map((food) => [food.id, food]))
  const candidates = picks.slice(0, 3).flatMap((pick) => {
    const food = byId.get(pick.food_id)
    return food ? [{ ...food, food_id: pick.food_id, confidence: Math.max(0, Math.min(1, Number(pick.confidence) || 0)) }] : []
  })
  if (!candidates.length) return error(422, 'no_match', 'No confident catalogue match was found')

  await Promise.all([
    fetch(`${env.SUPABASE_URL}/rest/v1/photo_jobs?on_conflict=user_id,image_hash`, {
      method: 'POST', headers: { ...adminHeaders, prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({
        user_id: user.id,
        image_hash: imageHash,
        candidates,
        status: 'complete',
        consent_version: PHOTO_AI_CONSENT_VERSION,
        consented_at: consentedAt!.toISOString(),
        expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    }),
    fetch(`${env.SUPABASE_URL}/rest/v1/usage_counters?on_conflict=user_id,feature,period_start`, {
      method: 'POST', headers: { ...adminHeaders, prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ user_id: user.id, feature: 'photo', period_start: monthStart, count: usage + 1 }),
    }),
  ])
  return json({ source: model, candidates })
}
