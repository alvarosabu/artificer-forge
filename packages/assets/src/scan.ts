import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parsePart, SLOT_FOLDERS, type PartEntry, type SlotFolder } from './partManifest'
import { PART_OVERRIDES } from './partOverrides'

export type PartManifest = { rigs: Record<string, string> } & Record<SlotFolder, PartEntry[]>

// Build-time scan of files/models/characters → part manifest. The filesystem
// is the database: dropping a GLB into a slot folder makes it a selectable
// part. armors/trousers/boots folders are skipped — those assets resolve
// through item YAML (modular.assets) — and root-level GLBs (rig_medium.glb…)
// are the canonical rigs plus legacy single-model characters.
export function scanParts(charactersDir: string): PartManifest {
  const manifest: PartManifest = {
    // Keyed by PartEntry.rig — a body's size token names the skeleton it binds to.
    rigs: {
      medium: '/models/characters/rig_medium.glb',
      small: '/models/characters/rig_small.glb',
    },
    bodies: [],
    heads: [],
    hair: [],
    beards: [],
    eyebrows: [],
    horns: [],
    accessories: [],
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
      else console.warn(`[assets] Unparseable part filename, skipped: ${folder}/${file} (expected GEN_/HUM_/ELF_/TIF_/GOB_-prefixed stem)`)
    }
  }
  return manifest
}
