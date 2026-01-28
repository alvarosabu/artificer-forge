// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@tresjs/nuxt',
    '@nuxt/devtools',
    '@nuxt/ui',
  ],
  css: ['~/assets/css/main.css'],
  compatibilityDate: '2025-01-01',
})