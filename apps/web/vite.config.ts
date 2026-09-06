import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // amazon-cognito-identity-js pulls in the Node `buffer` polyfill, which
  // expects a global `global` — the browser (and Vite's dev server) has
  // no such binding without this.
  define: { global: 'globalThis' },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // e2e/**/*.spec.ts are Playwright specs (run via `npm run test:e2e`),
    // not vitest unit tests — exclude them or vitest tries to run them too.
    exclude: ['e2e/**', 'node_modules/**'],
  },
})
