import { RACE_RIG, type Race, type RigKey } from '@artificer-forge/assets'

// Gear domain: which items a fresh character wears, and whether a fitted mesh
// can dress a given race's skeleton. Item YAML (modular.rig) declares the rig
// a piece is skinned to; absent = medium (all pre-goblin gear).

export type EquipSlot = 'helmet' | 'armor' | 'cloak' | 'trousers' | 'gauntlets' | 'boots'

const RIG_DEFAULT_EQUIPMENT: Record<RigKey, Record<EquipSlot, string | null>> = {
  medium: { helmet: null, armor: 'leather-jerkin', cloak: null, trousers: 'common-pants', gauntlets: null, boots: 'leather-sandals' },
  small: { helmet: null, armor: 'wild-raider-armor', cloak: null, trousers: 'wild-raider-pants', gauntlets: 'wild-raider-gauntlets', boots: 'wild-raider-boots' },
}

/** Starter equipment for a race, keyed by the skeleton it binds to. */
export function defaultEquipmentFor(race: Race): Record<EquipSlot, string | null> {
  return { ...RIG_DEFAULT_EQUIPMENT[RACE_RIG[race]] }
}

/** Whether an item's fitted meshes are skinned to the race's skeleton. */
export function fitsRig(modular: { rig?: RigKey } | undefined, race: Race): boolean {
  return (modular?.rig ?? 'medium') === RACE_RIG[race]
}
