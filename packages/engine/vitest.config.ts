import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // core rules + pure runtime utils (e.g. portrait helpers). Browser-dependent
    // runtime code has no node tests.
    include: ['src/core/**/*.test.ts', 'src/runtime/**/*.test.ts'],
  },
})
