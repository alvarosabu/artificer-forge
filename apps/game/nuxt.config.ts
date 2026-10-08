import { publicAssets } from './vite/publicAssets'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@tresjs/nuxt',
    '@nuxt/devtools',
    '@artificer-forge/assets/nuxt',
  ],
  hooks: {
    // client only: Nuxt runs a second Vite server for SSR, which would bake and reload twice
    'vite:extendConfig'(config, { isClient }) {
      if (isClient) config.plugins?.push(publicAssets())
    },
  },
  compatibilityDate: '2025-01-01',
})
