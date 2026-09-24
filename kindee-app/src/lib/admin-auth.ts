import { createClient } from '@supabase/supabase-js'

const adminUrl = import.meta.env.VITE_ADMIN_SUPABASE_URL?.trim().replace(/\/$/, '')
const dataUrl = import.meta.env.VITE_SUPABASE_URL?.trim().replace(/\/$/, '')
const adminKey = import.meta.env.VITE_ADMIN_SUPABASE_PUBLISHABLE_KEY?.trim()

export const adminSupabase = adminUrl && /^https:\/\//.test(adminUrl) &&
  adminUrl !== dataUrl && adminKey
  ? createClient(adminUrl, adminKey, {
      auth: {
        storageKey: 'kindee-admin-auth',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: window.location.pathname.startsWith('/admin'),
      },
    })
  : null
