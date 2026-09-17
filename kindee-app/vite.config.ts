import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          supabase: ['@supabase/supabase-js'],
          dexie: ['dexie'],
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Registered from src/main.tsx so a new deploy reloads open pages.
      injectRegister: false,
      workbox: { skipWaiting: true, clientsClaim: true, cleanupOutdatedCaches: true },
      includeAssets: ['logo.png', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'KinDee — นับแคลอรีที่เข้าใจอาหารไทย',
        short_name: 'KinDee',
        description: 'บันทึกมื้ออาหารใน 3 วินาที เข้าใจอาหารไทยและสินค้าในร้าน',
        lang: 'th',
        start_url: '/',
        display: 'standalone',
        background_color: '#f8f7f2',
        theme_color: '#3f7d68',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        ],
      },
    }),
  ],
})
