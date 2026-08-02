import { GoogleGenAI } from '@google/genai'
import { NextResponse } from 'next/server'

const geminiApiKey = process.env.GEMINI_API_KEY || ''

export async function POST(req: Request) {
  try {
    const { imageBase64 } = await req.json()

    if (!imageBase64) {
      return NextResponse.json({ error: 'Missing imageBase64 data' }, { status: 400 })
    }

    if (!geminiApiKey) {
      // Mock candidate return if API key not set yet
      return NextResponse.json({
        source: 'demo',
        candidates: [
          { name_th: 'ข้าวมันไก่ต้ม', kcal: 596, protein: 24, carb: 68, fat: 24, confidence: 'high' },
          { name_th: 'ข้าวมันไก่ทอด', kcal: 695, protein: 22, carb: 72, fat: 34, confidence: 'medium' },
          { name_th: 'ข้าวหน้าไก่', kcal: 480, protein: 20, carb: 62, fat: 16, confidence: 'low' },
        ],
      })
    }

    const ai = new GoogleGenAI({ apiKey: geminiApiKey })

    // Clean base64 prefix if present
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '')

    const prompt = `คุณคือผู้เชี่ยวชาญด้านโภชนาการและวิเคราะห์รูปอาหารไทย 
โปรดวิเคราะห์รูปอาหารต่อไปนี้ และส่งคืน candidate เมนูอาหารที่คาดว่าเป็นไปได้มากที่สุด 3 อันดับ

โปรดตอบกลับเฉพาะในรูปแบบ JSON Array ต่อไปนี้เท่านั้น (ห้ามใส่ markdown fence):
[
  {
    "name_th": "ชื่ออาหารภาษาไทย",
    "kcal": 550,
    "protein": 22,
    "carb": 65,
    "fat": 20,
    "confidence": "high"
  },
  {
    "name_th": "ชื่อเมนูทางเลือก 2",
    "kcal": 480,
    "protein": 18,
    "carb": 58,
    "fat": 16,
    "confidence": "medium"
  },
  {
    "name_th": "ชื่อเมนูทางเลือก 3",
    "kcal": 600,
    "protein": 25,
    "carb": 70,
    "fat": 22,
    "confidence": "low"
  }
]`

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: base64Data,
              },
            },
          ],
        },
      ],
    })

    const text = response.text || ''
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Failed to analyze food image' }, { status: 500 })
    }

    const candidates = JSON.parse(jsonMatch[0])
    return NextResponse.json({ source: 'gemini-1.5-flash', candidates })
  } catch (err: any) {
    console.error('Photo API exception:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
