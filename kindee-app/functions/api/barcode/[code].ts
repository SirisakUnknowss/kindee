import { error, json, supabaseHeaders, validBarcode, type PagesContext } from '../../_shared/http'

type Params = { code: string }

export async function onRequestGet({ env, params }: PagesContext<Params>) {
  const code = params.code
  if (!validBarcode(code)) return error(400, 'invalid_barcode', 'Barcode must contain 8–14 digits')
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
    return error(503, 'service_unconfigured', 'Barcode lookup is not configured')
  }

  const local = await fetch(
    `${env.SUPABASE_URL}/rest/v1/foods?barcode=eq.${encodeURIComponent(code)}&select=*,food_portions(*)&limit=1`,
    { headers: supabaseHeaders(env), cf: { cacheTtl: 3600, cacheEverything: true } } as RequestInit,
  )
  if (local.ok) {
    const rows = await local.json() as unknown[]
    if (rows.length) return json({ source: 'catalogue', food: rows[0] }, 200, { 'cache-control': 'public, max-age=3600' })
  }

  const provider = (env.BARCODE_PROVIDER_URL ?? 'https://world.openfoodfacts.org/api/v2/product').replace(/\/$/, '')
  const upstream = await fetch(`${provider}/${code}.json`, {
    headers: { 'user-agent': 'KinDee/1.0 (food lookup; contact configured by operator)' },
  })
  if (!upstream.ok) return error(502, 'provider_unavailable', 'Barcode provider is unavailable')
  const result = await upstream.json() as {
    status?: number
    product?: Record<string, unknown> & { nutriments?: Record<string, unknown> }
  }
  if (result.status !== 1 || !result.product) return error(404, 'not_found', 'Product not found')

  const product = result.product
  const nutrients = product.nutriments ?? {}
  const food = {
    barcode: code,
    name_th: product.product_name_th || product.product_name || 'สินค้าไม่ระบุชื่อ',
    name_en: product.product_name_en || null,
    brand: product.brands || null,
    image_url: product.image_front_small_url || null,
    package_size_g: product.product_quantity || product.serving_quantity || null,
    serving_size_g: product.serving_quantity || null,
    kcal_100g: nutrients['energy-kcal_100g'] ?? null,
    protein_100g: nutrients.proteins_100g ?? null,
    carb_100g: nutrients.carbohydrates_100g ?? null,
    fat_100g: nutrients.fat_100g ?? null,
    source: 'off',
    quality: 'unverified',
  }
  return json({ source: 'open_food_facts', food }, 200, { 'cache-control': 'public, max-age=86400' })
}
