import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    include: ['tests/**/*.test.ts', 'tests/**/*.spec.ts', '!tests/e2e/**'],
  },
  resolve: {
    alias: {
      '@': '/home/mark/.openclaw/workspace/integrated-allergy-testing',
    },
  },
})
