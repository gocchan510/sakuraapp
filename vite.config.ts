import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // B-16 Push 通知対応のため injectManifest に切替。
      // src/sw.ts で precache + push + notificationclick を扱う。
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      injectManifest: {
        // 1.8MB チャンクを precache 対象に含めるため上限を緩和
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,png,svg,ico,webmanifest}'],
      },
      manifest: {
        name: '花見どき',
        short_name: '花見どき',
        description: '日本全国1,433スポット・862品種。今週末の花見スポットがすぐわかる。',
        start_url: '/sakuraapp/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#D4507A',
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
          },
        ],
      },
    }),
  ],
  base: '/sakuraapp/',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-leaflet': ['leaflet'],
        },
      },
    },
  },
})
