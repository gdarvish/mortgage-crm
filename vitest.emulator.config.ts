/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import path from 'path'

/**
 * Emulator-backed tests. Kept apart from the default vitest config because
 * they need a running Firebase emulator suite — `npm run test` stays fast and
 * dependency-free, and these run under `firebase emulators:exec`.
 */
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  define: {
    // The service layer reads Vite env vars; the emulator ignores the values
    // but the client still needs them to be present and consistent.
    'import.meta.env.VITE_FIREBASE_API_KEY': JSON.stringify('demo-key'),
    'import.meta.env.VITE_FIREBASE_AUTH_DOMAIN': JSON.stringify('localhost'),
    'import.meta.env.VITE_FIREBASE_PROJECT_ID': JSON.stringify('mortgage-crm-service-test'),
    'import.meta.env.VITE_FIREBASE_STORAGE_BUCKET': JSON.stringify('mortgage-crm-service-test.appspot.com'),
    'import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID': JSON.stringify('0'),
    'import.meta.env.VITE_FIREBASE_APP_ID': JSON.stringify('demo-app'),
    'import.meta.env.VITE_USE_FIREBASE_EMULATOR': JSON.stringify('true'),
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/emulator/**/*.test.ts'],
    // Emulator state is shared, so suites must not interleave.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
})
