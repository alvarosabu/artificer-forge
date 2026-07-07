import { createResolver } from '@nuxt/kit'
const { resolve } = createResolver(import.meta.url)

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@tresjs/nuxt',
    '@nuxt/content',
    '@nuxt/devtools',
    '@nuxt/ui',
    '@pinia/nuxt',
    '@artificer-forge/dialog-editor',
  ],
  dialogEditor: {
    autocomplete: {
      items: { collection: 'entities', field: 'templateId', where: { type: 'item' } },
      abilities: { collection: 'abilities', field: 'abilityId' },
      statusEffects: { collection: 'statusEffect', field: 'statusEffectId' },
      classes: { collection: 'classes', field: 'classId' },
    },
  },
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
  build: {
    transpile: ['@artificer-forge/engine'],
  },
  icon: {
    customCollections: [{
      prefix: 'af',
      dir: resolve('./assets/icons'),
    }],
  },
})