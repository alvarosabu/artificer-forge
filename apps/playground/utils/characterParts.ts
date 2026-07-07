import manifest from '#build/character-parts.mjs'
import type { PartEntry, Sex } from './partManifest'

// Runtime view of the modular part manifest. Entries are GENERATED at build
// time by modules/part-manifest.ts (filesystem scan of public/models/characters
// + utils/partOverrides.ts) — add parts by dropping GLBs into the slot folders,
// not by editing this file. Domain types/helpers live in utils/partManifest.ts
// (auto-imported; not re-exported here to avoid duplicate-import warnings).

export const BODIES: PartEntry[] = manifest.bodies
export const HEADS: PartEntry[] = manifest.heads
export const HAIR: PartEntry[] = manifest.hair
export const BEARDS: PartEntry[] = manifest.beards
export const EYEBROWS: PartEntry[] = manifest.eyebrows
export const HORNS: PartEntry[] = manifest.horns
export const RIG_MEDIUM: string = manifest.rig

// Armor stays hand-declared: assets resolve through item YAML metadata, not the
// filename convention. TODO(M4): replace with modular.assets from item templates.
export const ARMORS: PartEntry[] = [
  { id: 'ARM_M_MEDIUM_Leather_Jerkin', templateId: 'leather-jerkin', label: 'Leather Jerkin', path: '/models/characters/armors/ARM_M_MEDIUM_Leather_Jerkin.glb', sex: 'M' },
  { id: 'ARM_F_MEDIUM_Leather_Jerkin', templateId: 'leather-jerkin', label: 'Leather Jerkin', path: '/models/characters/armors/ARM_F_MEDIUM_Leather_Jerkin.glb', sex: 'F' },
  { id: 'common_pants', templateId: 'common-pants', label: 'Common Pants', path: '/models/characters/trousers/common_pants.glb' },
  { id: 'leather_sandals', templateId: 'leather-sandals', label: 'Leather Sandals', path: '/models/characters/boots/leather_sandals.glb' },
]

/** The item's fitted asset for this sex (unisex entries match any sex). */
export function armorForItem(templateId: string, sex: Sex): PartEntry | undefined {
  return ARMORS.find(a => a.templateId === templateId && (!a.sex || a.sex === sex))
}
