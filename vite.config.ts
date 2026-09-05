/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'icons.svg'],
      manifest: {
        name: 'MortgageCRM — מערכת ניהול יועץ משכנתאות',
        short_name: 'MortgageCRM',
        description: 'מערכת לניהול תיקי משכנתא, לקוחות ולידים ליועצי משכנתאות',
        lang: 'he',
        dir: 'rtl',
        theme_color: '#059669',
        background_color: '#faf9f7',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff,woff2}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    // Node by default — most tests are pure. Component tests opt into jsdom
    // with a `// @vitest-environment jsdom` pragma, so the fast majority is
    // not slowed down by a DOM they never touch.
    environment: 'node',
    // tests/unit holds checks that are about the project rather than a module
    // — index coverage, for one. tests/emulator runs under its own config.
    include: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      'tests/unit/**/*.test.ts',
      'tests/unit/**/*.test.tsx',
    ],
    setupFiles: ['./tests/setup.ts'],
    // `vitest run --coverage` needs @vitest/coverage-v8 installed alongside;
    // it is not a dependency here because its peer graph currently conflicts
    // with this vitest version. See CONTRIBUTING.md.
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.*', 'src/main.tsx', 'src/vite-env.d.ts'],
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) return 'firebase'
          if (
            id.includes('node_modules/recharts') ||
            id.includes('node_modules/d3-') ||
            id.includes('node_modules/victory-')
          ) return 'charts'
          if (id.includes('node_modules/jspdf')) return 'pdf'
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/react-router') ||
            id.includes('node_modules/scheduler/')
          ) return 'react'
          return undefined
        },
      },
    },
  },
})
