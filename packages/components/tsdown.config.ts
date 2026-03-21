import { defineConfig } from 'tsdown'
import vue from 'unplugin-vue/rolldown'

export default defineConfig({
  entry: ['src/tres/index.ts', 'src/ui/index.ts'],
  format: ['esm'],
  dts: {
    vue: true,
  },
  clean: true,
  external: ['vue', 'three', 'three/webgpu', 'three/tsl'],
  plugins: [vue()],
})
