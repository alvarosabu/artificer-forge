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
})