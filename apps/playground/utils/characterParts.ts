import manifest from '#build/character-parts.mjs'
import type { PartEntry } from '@artificer-forge/assets'

// Runtime view of the modular part manifest. Entries are GENERATED at build
// time by @artificer-forge/assets/nuxt (filesystem scan of the package's
// files/models/characters + partOverrides) — add parts by dropping GLBs into
// the slot folders, not by editing this file. Domain types/helpers come from
// @artificer-forge/assets.

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
