/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_APP_ENV?: 'development' | 'staging' | 'production'
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_ADMIN_SUPABASE_URL?: string
  readonly VITE_ADMIN_SUPABASE_PUBLISHABLE_KEY?: string
  readonly VITE_BILLING_ENABLED?: string
  readonly VITE_DONATE_QR_URL?: string
  readonly VITE_DONATE_RECIPIENT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
