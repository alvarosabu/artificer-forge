import { join } from 'node:path'
import { addTemplate, addTypeTemplate, createResolver, defineNuxtModule } from '@nuxt/kit'
import { scanParts } from './scan'

// Shared asset library. Consuming apps get:
//  - /models/... and /textures/... served from this package's files/ dir
//  - #build/character-parts.mjs — build-time scan of files/models/characters
//    (dropping a GLB into a slot folder makes it a selectable part)
export default defineNuxtModule({
  meta: { name: '@artificer-forge/assets' },
  setup(_options, nuxt) {
    const { resolve } = createResolver(import.meta.url)
    const filesDir = resolve('../files')
    const charactersDir = join(filesDir, 'models', 'characters')

    // nitro options are typed by the @nuxt/nitro-server builder, which modules
    // don't depend on, so the shape is declared manually
    const { nitro } = nuxt.options as unknown as { nitro: { publicAssets?: { dir: string }[] } }
    nitro.publicAssets ||= []
    nitro.publicAssets.push({ dir: filesDir })

    addTemplate({
      filename: 'character-parts.mjs',
      write: true,
      getContents: () => `export default ${JSON.stringify(scanParts(charactersDir), null, 2)}\n`,
    })

    addTypeTemplate({
      filename: 'types/character-parts.d.ts',
      getContents: () => `
declare module '#build/character-parts.mjs' {
  import type { PartEntry } from '@artificer-forge/assets'

  const manifest: {
    rigs: Record<'medium' | 'small', string>
    bodies: PartEntry[]
    heads: PartEntry[]
    hair: PartEntry[]
    beards: PartEntry[]
    eyebrows: PartEntry[]
    horns: PartEntry[]
    accessories: PartEntry[]
  }
  export default manifest
}
`,
    })

    // New/renamed GLBs require a restart; watching the folder turns that into
    // an automatic dev-server reload.
    nuxt.options.watch.push(join(charactersDir, '**'))
  },
})
