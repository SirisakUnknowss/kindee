import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/kindee/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'KinDee — นับแคลอรีที่เข้าใจอาหารไทย',
        short_name: 'KinDee',
        description: 'บันทึกมื้ออาหารใน 3 วินาที เข้าใจอาหารไทยและสินค้าในร้าน',
        lang: 'th',
        start_url: '/kindee/',
        display: 'standalone',
        background_color: '#f3f5fe',
        theme_color: '#796cbf',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
    }),
  ],
})
