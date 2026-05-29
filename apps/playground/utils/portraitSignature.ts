import type { Equipment } from '~/stores/game'

export interface PortraitAppearance {
  model?: string
  rig?: string
  equipment: Equipment
}

// Stable string identifying everything that affects how a portrait looks.
// Same appearance -> same signature -> cache hit. Changed gear/model -> new signature -> re-bake.
export function portraitSignature(a: PortraitAppearance): string {
  return [
    a.model ?? '',
    a.rig ?? '',
    a.equipment.mainHand ?? '',
    a.equipment.offHand ?? '',
  ].join('|')
}
