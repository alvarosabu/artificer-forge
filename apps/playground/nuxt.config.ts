// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@tresjs/nuxt',
    '@nuxt/content',
    '@nuxt/devtools',
    '@nuxt/ui',
    '@pinia/nuxt',
  ],
  css: ['~/assets/css/main.css'],
  compatibilityDate: '2025-01-01',
  ui: {
    theme: {
      colors: ['primary', 'secondary', 'success', 'error', 'warning'],
    },
  },
  fonts: {
    families: [
      { name: 'Crimson Pro', provider: 'google', weights: [400, 500, 600, 700] },
    ],
  },
})