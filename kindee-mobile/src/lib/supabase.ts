import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'
import { AppState } from 'react-native'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim()
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()

/** Base URL of the deployed Cloudflare Pages app that hosts /api/*. */
export const API_BASE = (process.env.EXPO_PUBLIC_API_BASE?.trim() || 'https://kindee.pages.dev').replace(/\/$/, '')

export const isSupabaseConfigured = Boolean(supabaseUrl && /^https:\/\//.test(supabaseUrl) && supabaseKey)

/** Only the publishable key ships in the app; privileged keys stay in Pages Functions. */
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseKey!, {
      auth: {
        storage: AsyncStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null

// React Native has no tab visibility: refresh tokens only while the app is in the foreground.
if (supabase) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') void supabase.auth.startAutoRefresh()
    else void supabase.auth.stopAutoRefresh()
  })
}
