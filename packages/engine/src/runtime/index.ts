// @artificer-forge/engine/runtime — Vue/Tres/Three stores, systems, controllers, scene components.

// Scene components
export { default as Floor } from './components/Floor.vue'
export { default as Foliage } from './components/foliage/Foliage.vue'
export * from './components/foliage/foliage'

// Stores
export * from './stores/game'
export * from './stores/damageTypes'
export * from './stores/statusEffects'
export * from './stores/surface'
export * from './stores/portraits'
export * from './stores/combat'
export * from './stores/dialog'

// Combat / ability / dialog systems
export * from './useProjectile'
export * from './useAoESystem'
export * from './useActionBar'
export * from './useAbilitySystem'
export * from './useDialogEngine'
export * from './useDialogCamera'

// Movement / animation controllers
export * from './useCharacterAnimations'
export * from './useCharacterController'
export * from './usePointerController'
export * from './useSceneRefs'
export * from './useEquipment'

// Portrait generator (3D-rendered character portraits)
export * from './portrait/portraitBackgrounds'
export * from './portrait/portraitBakeQueue'
export * from './portrait/portraitRigPresets'
export * from './portrait/portraitSignature'
export * from './portrait/usePortraitStudio'
export * from './portrait/usePortraitRenderer'
export { default as PortraitStudio } from './components/portrait/Studio.vue'
export { default as PortraitSubject } from './components/portrait/Subject.vue'
export { default as PortraitBackground } from './components/portrait/Background.vue'
export { default as PortraitLights } from './components/portrait/Lights.vue'
