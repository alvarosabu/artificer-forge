import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    setupFiles: ['test/setup.ts'],
    // game store transitively imports @tresjs/cientos via @artificer-forge/engine;
    // inline it so Vite's resolver handles its directory imports (node ESM can't).
    server: {
      deps: {
        inline: [/@tresjs/, /three-custom-shader-material/],
      },
    },
  },
})
