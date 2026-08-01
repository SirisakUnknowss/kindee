import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
)

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token)

    if (userError || !userData.user) {
      return NextResponse.json({ error: 'Invalid user token' }, { status: 401 })
    }

    const userId = userData.user.id
    const body = await req.json()
    const { ops, since } = body

    if (!Array.isArray(ops) || ops.length > 200) {
      return NextResponse.json({ error: 'Invalid batch size (max 200)' }, { status: 400 })
    }

    const appliedClientIds: string[] = []
    const now = new Date().toISOString()

    for (const op of ops) {
      const payload = op.payload
      if (!payload || !payload.client_id) continue

      // Validate bounds
      const kcal = Math.min(Math.max(Number(payload.kcal) || 0, 0), 10000)
      const qty = Math.max(Number(payload.qty) || 1, 0.1)

      const entryRow = {
        user_id: userId,
        client_id: payload.client_id,
        food_id: payload.food_id || null,
        portion_id: payload.portion_id || null,
        qty: qty,
        grams: payload.grams || null,
        meal: payload.meal || 'lunch',
        eaten_at: payload.eaten_at || now,
        eaten_on: payload.eaten_on || now.split('T')[0],
        food_name: payload.food_name || 'อาหาร',
        kcal: kcal,
        protein: payload.protein || null,
        carb: payload.carb || null,
        fat: payload.fat || null,
        entry_source: payload.entry_source || 'manual',
        deleted_at: payload.deleted_at || null,
        updated_at: payload.updated_at || now,
      }

      // Idempotent upsert on (user_id, client_id)
      const { error: upsertErr } = await supabaseAdmin
        .from('entries')
        .upsert(entryRow, { onConflict: 'user_id,client_id' })

      if (!upsertErr) {
        appliedClientIds.push(payload.client_id)
      } else {
        console.error('Entry upsert error:', upsertErr)
      }
    }

    // Fetch changes from server since `since` for other devices
    let remoteChanges: any[] = []
    if (since) {
      const { data: changes } = await supabaseAdmin
        .from('entries')
        .select('*')
        .eq('user_id', userId)
        .gt('updated_at', since)

      if (changes) remoteChanges = changes
    }

    return NextResponse.json({
      appliedClientIds,
      remoteChanges,
      now,
    })
  } catch (err: any) {
    console.error('Sync API Route exception:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
