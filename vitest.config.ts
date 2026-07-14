import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules', 'out', 'dist'],
    deps: {
      external: ['better-sqlite3', 'electron'],
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/renderer/**',
        'src/preload/**',
        'src/main/index.ts',
        'src/main/ipc-handlers.ts'
      ]
    }
  },
  resolve: {
    alias: {
      '@': resolve('src/renderer/src')
    }
  }
})
