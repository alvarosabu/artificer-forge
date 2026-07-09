import type { CharacterAppearance } from '../../core/appearance'
import type { Equipment } from '../stores/game'
import type { ArmorPiece } from '../modular/useModularRig'

export interface PortraitAppearance {
  model?: string
  /** Modular characters: cosmetic recipe instead of (or alongside) a model URL. */
  appearance?: CharacterAppearance
  /** Modular characters: resolved armor pieces (visuals derive from equipment). */
  armor?: ArmorPiece[]
  rig?: string
  equipment: Equipment
  // Backdrop texture URL; part of the look, so a different/added backdrop re-bakes.
  background?: string
}

// Bump when the render pipeline (framing, lighting, resolution) changes so that
// persisted portraits baked by older logic are invalidated and re-baked.
const PORTRAIT_CACHE_VERSION = 'v8'

// Stable string identifying everything that affects how a portrait looks.
// Same appearance -> same signature -> cache hit. Changed gear/model -> new signature -> re-bake.
export function portraitSignature(a: PortraitAppearance): string {
  return [
    PORTRAIT_CACHE_VERSION,
    a.model ?? '',
    a.appearance ? JSON.stringify(a.appearance) : '',
    a.armor?.map(p => `${p.id}:${p.tint ?? ''}`).join(',') ?? '',
    a.rig ?? '',
    a.equipment.mainHand ?? '',
    a.equipment.offHand ?? '',
    a.background ?? '',
  ].join('|')
}
