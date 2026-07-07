import type { PartOverride } from './partManifest'

// Manifest exceptions the filename convention can't express, keyed by part id
// (filename stem) and merged over the scanned entry by modules/part-manifest.ts.
// Exceptions ONLY — never inventory; a part must still exist on disk to appear.

export const PART_OVERRIDES: Record<string, PartOverride> = {
  // Tieflings borrow the elf heads until dedicated TIF_ heads are exported.
  ELF_M_Head_A: { race: ['elf', 'tiefling'] },
  ELF_F_Head_A: { race: ['elf', 'tiefling'] },
  // Every race shares the human silhouettes until race-specific bodies exist
  // (race: undefined = any race, same semantics as GEN_ parts).
  HUM_M_MEDIUM_Body_A: { race: undefined },
  HUM_F_MEDIUM_Body_A: { race: undefined },
}
