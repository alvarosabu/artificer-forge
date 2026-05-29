import { addComponentsDir, addImportsDir, addServerHandler, createResolver, defineNuxtModule, extendPages } from '@nuxt/kit'

export interface AutocompleteSource {
  collection: string
  field: string
  where?: Record<string, unknown>
}

export interface ModuleOptions {
  enabled?: boolean
  route?: string
  dialogsDir?: string
  layoutDir?: string
  autocomplete?: {
    skills?: string[]
    items?: AutocompleteSource
    abilities?: AutocompleteSource
    statusEffects?: AutocompleteSource
    classes?: AutocompleteSource
  }
}

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: '@artificer-forge/dialog-editor',
    configKey: 'dialogEditor',
  },
  defaults: nuxt => ({
    enabled: nuxt.options.dev,
    route: '/__dialog-editor',
    dialogsDir: 'content/dialogs',
    layoutDir: 'content/dialogs/.layouts',
    autocomplete: {},
  }),
  setup(options, nuxt) {
    if (!options.enabled) return

    const resolver = createResolver(import.meta.url)

    // Vue Flow must be transpiled by Nuxt, and so must our runtime.
    nuxt.options.build.transpile.push(
      resolver.resolve('./runtime'),
      '@vue-flow/core',
      '@vue-flow/background',
      '@vue-flow/controls',
      '@vue-flow/minimap',
    )

    // Client-visible config.
    nuxt.options.runtimeConfig.public.dialogEditor = {
      route: options.route!,
      autocomplete: options.autocomplete ?? {},
    }
    // Server-only paths.
    nuxt.options.runtimeConfig.dialogEditor = {
      dialogsDir: options.dialogsDir!,
      layoutDir: options.layoutDir!,
    }

    addComponentsDir({ path: resolver.resolve('./runtime/components'), prefix: 'De', global: false })
    addImportsDir(resolver.resolve('./runtime/composables'))

    extendPages((pages) => {
      pages.unshift({
        name: 'dialog-editor',
        path: options.route!,
        file: resolver.resolve('./runtime/pages/editor.vue'),
      })
    })

    addServerHandler({
      route: '/api/__dialog-editor/dialogs',
      method: 'get',
      handler: resolver.resolve('./runtime/server/api/dialogs/index.get'),
    })
    addServerHandler({
      route: '/api/__dialog-editor/dialogs/:id',
      method: 'get',
      handler: resolver.resolve('./runtime/server/api/dialogs/[id].get'),
    })
  },
})
