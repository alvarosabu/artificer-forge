// Modular character appearance — pure cosmetics. Presence of `appearance` on a
// character entity switches rendering from the single-GLB path (entity.model)
// to modular assembly (useModularRig). Armor visuals are NOT part of
// appearance: they derive from the entity's actually equipped items.

export type Sex = 'M' | 'F'

/** Equipment slots that render as modular meshes on the body. */
export type ModularSlot = 'helmet' | 'armor' | 'cloak' | 'trousers' | 'gauntlets' | 'boots'

export type HornPattern = 'gradient' | 'repeated' | 'solid'

/** Per-body-segment material swap (e.g. Cedric's ghostly right arm). Keys are
 * segment tokens: sided (`armR`, `handL`) target one side, side-agnostic
 * (`arm`, `leg`) target both. `material` names a factory the app registered
 * via registerSegmentMaterials. */
export interface SegmentMaterialOverride {
  segments: string[]
  material: string
  params?: Record<string, unknown>
}

export interface CharacterAppearance {
  /** Part ids = manifest ids = mesh node names (filename stems). */
  body: string
  head: string
  hair: string | null
  beard: string | null
  eyebrows: string | null
  /** Cosmetic accessory (piercing, earring…). Optional: pre-accessory templates omit it. */
  accessory?: string | null
  horns: string | null
  skinColor: string
  hairColor: string
  hornColorA?: string
  hornColorB?: string
  hornPattern?: HornPattern
  /** 0..1 split point where horn color A hands over to B. */
  hornWeight?: number
  /** Cosmetic palette-atlas tint id per slot; absent = the item's base atlas. */
  equipmentTint?: Partial<Record<ModularSlot, string>>
  segmentMaterials?: SegmentMaterialOverride[]
}
