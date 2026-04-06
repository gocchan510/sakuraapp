import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: '桜週末ガイド',
        short_name: '桜ガイド',
        description: '今週末どこで桜を見ればいい？',
        start_url: '/sakuraapp/',
        display: 'standalone',
        background_color: '#fce4ec',
        theme_color: '#f4a7b9',
        lang: 'ja',
        icons: [
          {
            src: '/sakuraapp/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/sakuraapp/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
      },
    }),
  ],
  base: '/sakuraapp/',
})
