export default defineNuxtConfig({
  modules: ['@barzhsieh/nuxt-content-mermaid'],
  contentMermaid: {
    // Match diagrams to the Docus light/dark theme.
    theme: { light: 'default', dark: 'dark' },
  },
  css: ['~/assets/css/main.css'],
  fonts: {
    families: [
      { name: 'Crimson Pro', provider: 'google', weights: [400, 500, 600, 700] },
    ],
  },
  pwa: {
    enabled: false,
  },
})
