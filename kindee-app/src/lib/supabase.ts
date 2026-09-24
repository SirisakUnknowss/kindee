import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabaseKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY
)?.trim()

export const isSupabaseConfigured = Boolean(
  supabaseUrl && /^https:\/\//.test(supabaseUrl) && supabaseKey,
)

/**
 * The browser receives only the Supabase publishable key. Privileged keys live in
 * Cloudflare Pages Functions and are never accepted through a VITE_* variable.
 */
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: !window.location.pathname.startsWith('/admin'),
      },
    })
  : null
