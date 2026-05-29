import type { Equipment } from '~/stores/game'

export interface PortraitAppearance {
  model?: string
  rig?: string
  equipment: Equipment
}

// Bump when the render pipeline (framing, lighting, resolution) changes so that
// persisted portraits baked by older logic are invalidated and re-baked.
const PORTRAIT_CACHE_VERSION = 'v3'

// Stable string identifying everything that affects how a portrait looks.
// Same appearance -> same signature -> cache hit. Changed gear/model -> new signature -> re-bake.
export function portraitSignature(a: PortraitAppearance): string {
  return [
    PORTRAIT_CACHE_VERSION,
    a.model ?? '',
    a.rig ?? '',
    a.equipment.mainHand ?? '',
    a.equipment.offHand ?? '',
  ].join('|')
}
