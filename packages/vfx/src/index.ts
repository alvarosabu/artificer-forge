export { default as DamageNumber } from './components/DamageNumber.vue'
export { default as TargetIndicator } from './components/TargetIndicator.vue'
export { useDamageNumbers, type DamageEntry, type DamageType } from './composables/useDamageNumbers'

// Materials
export { ghostMaterial } from './materials/ghost'
export {
  buildWorleyEmissiveNode,
  buildBurningEmissiveNode,
  buildFrozenEmissiveNode,
  STATUS_OVERLAY_EFFECTS,
  STATUS_OVERLAY_BUILDERS,
  type StatusOverlayEffectId,
  type StatusOverlayEffectConfig,
} from './materials/statusEffects'

// Particles
export {
  createEmberSystem,
  heatColor,
  lerpRgb,
  EMBER_COUNT,
  CHAR_HEIGHT,
  MAX_RADIUS,
  RESET_Y,
  type EmberMeta,
} from './particles/emberSystem'

export { createInstancedEmberSystem } from './particles/instancedEmberSystem'
export { createFireBillboards } from './particles/fireBillboards'

// Surface materials
export { buildFireSurfaceMaterial } from './materials/fireSurface'
export { buildCharcoalSurfaceMaterial } from './materials/charcoalSurface'
export { buildPoolSurfaceMaterial } from './materials/poolSurface'

// Components
export { default as TargetReticle } from './components/TargetReticle.vue'