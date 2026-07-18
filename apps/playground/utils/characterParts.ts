import manifest from '#build/character-parts.mjs'
import type { PartEntry } from './partManifest'

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
export const ACCESSORIES: PartEntry[] = manifest.accessories
/** Skeleton GLBs keyed by PartEntry.rig ('medium' | 'small'). */
export const RIGS: Record<string, string> = manifest.rigs

// Armor assets are NOT listed here: item YAML (modular.assets) is the source of
// truth, resolved per body sex by useModularArmor (in-game) and the create page
// (customizer preview).
