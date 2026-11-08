import { publicAssets } from './vite/publicAssets'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@tresjs/nuxt',
    '@nuxt/devtools',
    '@nuxt/ui',
    '@artificer-forge/assets/nuxt',
  ],
  css: ['~/assets/css/main.css'],
  // the theme declares its own @font-face for Rando Mono; @nuxt/fonts would try to fetch it from a provider
  ui: {
    fonts: false,
  },
  // own key: the playground shares the localhost origin and its stored mode would override 'dark'
  colorMode: {
    preference: 'dark',
    fallback: 'dark',
    storageKey: 'game-color-mode',
  },
  app: {
    head: {
      link: [
        { rel: 'preload', as: 'font', type: 'font/otf', href: '/fonts/RandoMono-Bold.otf', crossorigin: '' },
        { rel: 'preload', as: 'font', type: 'font/otf', href: '/fonts/RandoMono-Chonk.otf', crossorigin: '' },
      ],
    },
  },
  tres: {
    renderer: 'webgpu',
  },
  hooks: {
    // client only: Nuxt runs a second Vite server for SSR, which would bake and reload twice
    'vite:extendConfig'(config, { isClient }) {
      if (isClient) config.plugins?.push(publicAssets())
    },
  },
  compatibilityDate: '2025-01-01',
})
