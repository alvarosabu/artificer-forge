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
    // all three entrypoints (three, three/webgpu, three/tsl, three/examples/*, three/addons/*)
    /^three(\/.*)?$/,
    '@tresjs/core',
    '@tresjs/cientos',
    '@vueuse/core',
    'pinia',
    // all @nuxt/ui entrypoints incl. composables (useToast etc.) — the consuming
    // Nuxt app resolves them (they rely on Nuxt's #imports at runtime).
    /^@nuxt\/ui(\/.*)?$/,
    '@artificer-forge/vfx',
    '@artificer-forge/post-processing',
    // self-subpaths: entries reference each other as externals (resolved at runtime
    // via the package's own exports map), no cross-entry bundling duplication.
    /^@artificer-forge\/engine\//,
  ],
  plugins: [vue()],
})
