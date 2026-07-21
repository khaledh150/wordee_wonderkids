import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,woff2}'],
        globIgnores: ['**/version.json'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: /\/version\.json/,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /\.(?:png|webp|svg|ico)$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'images',
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 90 },
            },
          },
          {
            urlPattern: /\.(?:mp3|wav)$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'audio',
              expiration: { maxEntries: 600, maxAgeSeconds: 60 * 60 * 24 * 90 },
            },
          },
        ],
      },
      manifest: false,
    }),
  ],
  build: {
    target: ['es2015', 'chrome64', 'safari12', 'firefox62'],
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('framer-motion')) return 'framer-motion'
            if (id.includes('react')) return 'vendor'
          }
        },
      },
    },
  },
})
