import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { addTemplate, addTypeTemplate, createResolver, defineNuxtModule } from '@nuxt/kit'
import { parsePart, SLOT_FOLDERS, type PartEntry, type SlotFolder } from '../utils/partManifest'
import { PART_OVERRIDES } from '../utils/partOverrides'

// Build-time scan of public/models/characters → generated part manifest
// (#build/character-parts.mjs). The filesystem is the database: dropping a GLB
// into a slot folder makes it a selectable part (after dev-server restart).
// armors/trousers/boots folders are skipped — those assets resolve through item
// YAML (modular.assets) — and root-level GLBs (hero.glb, rig_medium.glb…) are
// legacy single-model characters plus the canonical rig.

export default defineNuxtModule({
  meta: { name: 'part-manifest' },
  setup(_options, nuxt) {
    const { resolve } = createResolver(import.meta.url)
    const charactersDir = resolve('../public/models/characters')

    function scan() {
      const manifest: { rig: string } & Record<SlotFolder, PartEntry[]> = {
        rig: '/models/characters/rig_medium.glb',
        bodies: [],
        heads: [],
        hair: [],
        beards: [],
        eyebrows: [],
        horns: [],
      }
      for (const folder of SLOT_FOLDERS) {
        let files: string[] = []
        try {
          files = readdirSync(join(charactersDir, folder)).filter(f => f.endsWith('.glb'))
        }
        catch { continue }
        for (const file of files.sort()) {
          const stem = file.replace(/\.glb$/, '')
          const part = parsePart(stem, folder, PART_OVERRIDES)
          if (part) manifest[folder].push(part)
          else console.warn(`[part-manifest] Unparseable part filename, skipped: ${folder}/${file} (expected GEN_/HUM_/ELF_/TIF_-prefixed stem)`)
        }
      }
      return manifest
    }

    addTemplate({
      filename: 'character-parts.mjs',
      write: true,
      getContents: () => `export default ${JSON.stringify(scan(), null, 2)}\n`,
    })

    addTypeTemplate({
      filename: 'types/character-parts.d.ts',
      getContents: () => `
declare module '#build/character-parts.mjs' {
  import type { PartEntry } from '~/utils/partManifest'

  const manifest: {
    rig: string
    bodies: PartEntry[]
    heads: PartEntry[]
    hair: PartEntry[]
    beards: PartEntry[]
    eyebrows: PartEntry[]
    horns: PartEntry[]
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
