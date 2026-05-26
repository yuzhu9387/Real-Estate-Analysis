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
    // DB tests share a single Postgres instance; run files serially to avoid
    // cross-file truncateAll races.
    fileParallelism: false,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
