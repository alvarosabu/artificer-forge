import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  // engine exports point at source, so its `runtime` barrel re-exports raw .vue
  // SFCs into our tests; compile them here (the engine's own vitest never hits
  // the barrel, so it doesn't need this).
  plugins: [vue()],
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
