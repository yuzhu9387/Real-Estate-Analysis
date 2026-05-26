import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['node_modules', 'legacy', '.next', 'out'],
    environmentMatchGlobs: [
      ['components/**', 'jsdom'],
      ['app/**', 'jsdom'],
    ],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
