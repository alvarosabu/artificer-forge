// Armor derivation — pure. Max armor pools = sum of `armor` across equipped items.

export interface ArmorItem {
  armor?: { physical?: number, magical?: number }
}

/** Sum the physical/magical armor contributed by a character's equipped items. */
export function deriveMaxArmor(equipped: ArmorItem[]): { physical: number, magical: number } {
  let physical = 0
  let magical = 0
  for (const item of equipped) {
    physical += item.armor?.physical ?? 0
    magical += item.armor?.magical ?? 0
  }
  return { physical, magical }
}
