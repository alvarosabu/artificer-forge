import { defineConfig } from 'tsdown'
import vue from 'unplugin-vue/rolldown'

export default defineConfig({
  entry: ['src/core/index.ts', 'src/runtime/index.ts', 'src/ui/index.ts'],
  format: ['esm'],
  dts: {
    vue: true,
  },
  clean: true,
  external: [
    'vue',
    'three',
    'three/webgpu',
    'three/tsl',
    '@tresjs/core',
    '@tresjs/cientos',
    '@vueuse/core',
    'pinia',
    '@nuxt/ui',
    '@artificer-forge/vfx',
    '@artificer-forge/post-processing',
  ],
  plugins: [vue()],
})
