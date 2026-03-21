import { defineConfig } from 'tsdown'
import vue from 'unplugin-vue/rolldown'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: {
    vue: true,
  },
  clean: true,
  external: ['vue', 'three', '@tresjs/core', '@tresjs/cientos', '@vueuse/core'],
  plugins: [vue()],
})
