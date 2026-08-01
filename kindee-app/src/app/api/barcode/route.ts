import { createClient } from '@supabase/supabase-js'
import { GoogleGenAI } from '@google/genai'
import { NextResponse } from 'next/server'
import { normalizeThai } from '@/lib/thai'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
)

const geminiApiKey = process.env.GEMINI_API_KEY || ''

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const code = searchParams.get('code')

    if (!code) {
      return NextResponse.json({ error: 'Missing barcode code' }, { status: 400 })
    }

    // 1. Check local Supabase database first
    const { data: existingFood } = await supabaseAdmin
      .from('foods')
      .select('*, food_portions(*)')
      .eq('barcode', code)
      .single()

    if (existingFood) {
      return NextResponse.json({ source: 'db', food: existingFood })
    }

    // 2. If not found in DB, use Gemini 1.5 Flash to analyze/lookup food info
    if (!geminiApiKey) {
      return NextResponse.json({ error: 'Barcode not found in DB', code }, { status: 404 })
    }

    const ai = new GoogleGenAI({ apiKey: geminiApiKey })
    const prompt = `คุณคือผู้เชี่ยวชาญด้านอาหารและสินค้าโภชนาการไทย โปรดช่วยระบุรายละเอียดโภชนาการของสินค้าที่มีบาร์โค้ดหมายเลข: "${code}"

โปรดตอบกลับเฉพาะในรูปแบบ JSON Object ต่อไปนี้เท่านั้น (ห้ามใส่ markdown fence):
{
  "name_th": "ชื่อสินค้าภาษาไทย (เช่น นมพร่องมันเนย UHT รสจืด โฟร์โมสต์ 180 มล.)",
  "name_en": "English product name",
  "brand": "ชื่อแบรนด์",
  "category": "หมวดหมู่ (เช่น เครื่องดื่ม, ขนมขบเคี้ยว, นม)",
  "kcal_100g": 60.0,
  "protein_100g": 3.2,
  "carb_100g": 4.8,
  "fat_100g": 1.5,
  "package_size_g": 180,
  "serving_size_g": 180,
  "servings_per_pkg": 1,
  "portion_label": "ทั้งซอง / ทั้งขวด / 1 กล่อง",
  "portion_grams": 180
}`

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: prompt,
    })

    const text = response.text || ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Barcode not found by AI', code }, { status: 404 })
    }

    const parsed = JSON.parse(jsonMatch[0])
    const search_text = normalizeThai(parsed.name_th + ' ' + (parsed.brand || ''))

    // 3. Save AI-analyzed food into Supabase foods table for caching
    const newFoodRow = {
      name_th: parsed.name_th,
      name_en: parsed.name_en || null,
      brand: parsed.brand || null,
      barcode: code,
      category: parsed.category || 'สินค้าในร้าน',
      is_dish: false,
      is_packaged: true,
      kcal_100g: Number(parsed.kcal_100g) || 0,
      protein_100g: Number(parsed.protein_100g) || null,
      carb_100g: Number(parsed.carb_100g) || null,
      fat_100g: Number(parsed.fat_100g) || null,
      package_size_g: Number(parsed.package_size_g) || null,
      serving_size_g: Number(parsed.serving_size_g) || null,
      servings_per_pkg: Number(parsed.servings_per_pkg) || 1,
      source: 'ai',
      quality: 'community',
      search_text,
      is_public: true,
    }

    const { data: insertedFood, error: insertErr } = await supabaseAdmin
      .from('foods')
      .insert(newFoodRow)
      .select()
      .single()

    if (insertErr) {
      console.error('Failed to cache AI food to DB:', insertErr)
      return NextResponse.json({ source: 'ai_uncached', food: newFoodRow })
    }

    // Insert default portion
    if (insertedFood && parsed.portion_label) {
      await supabaseAdmin.from('food_portions').insert({
        food_id: insertedFood.id,
        label_th: parsed.portion_label,
        grams: parsed.portion_grams || parsed.package_size_g || 100,
        is_default: true,
      })
    }

    return NextResponse.json({ source: 'ai', food: insertedFood || newFoodRow })
  } catch (err: any) {
    console.error('Barcode API exception:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
