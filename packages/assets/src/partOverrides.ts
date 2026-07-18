import type { PartOverride } from './partManifest'

// Manifest exceptions the filename convention can't express, keyed by part id
// (filename stem) and merged over the scanned entry by src/scan.ts.
// Exceptions ONLY — never inventory; a part must still exist on disk to appear.

export const PART_OVERRIDES: Record<string, PartOverride> = {
  // Medium races share the human silhouettes until race-specific bodies exist.
  // Explicit list (not race: undefined) so small-rig races don't inherit them.
  HUM_M_MEDIUM_Body_A: { race: ['human', 'elf', 'tiefling'] },
  HUM_F_MEDIUM_Body_A: { race: ['human', 'elf', 'tiefling'] },
  // Only M goblin hair/brows exist — let F goblins use them rather than go bald.
  GOB_M_Hair_Short_A: { sex: undefined },
  GOB_M_Eyebrows_Thick_A: { sex: undefined },
}
