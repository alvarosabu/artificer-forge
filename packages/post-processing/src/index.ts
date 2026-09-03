export { default as EffectComposer } from './EffectComposer.vue'
export type { AntialiasMode, BloomConfig, DofConfig, GodraysConfig, OutlinePreset, TiltShiftConfig } from './EffectComposer.vue'
export { ScaledBloomNode, scaledBloom } from './ScaledBloomNode'
export { ScaledDepthOfFieldNode, scaledDof } from './ScaledDepthOfFieldNode'
export { tiltShift, type TiltShiftNodes, type TiltShiftOptions, type TiltShiftResult } from './tiltShift'
export {
  useOutlinePass,
  useOutlinePassProvider,
  OutlinePassKey,
  type OutlinePassApi,
} from './useOutlinePass'
export {
  useDofFocus,
  useDofFocusProvider,
  DofFocusKey,
  type DofFocusApi,
} from './useDofFocus'
export {
  useGodraysLight,
  useGodraysLightProvider,
  GodraysLightKey,
  type GodraysLightApi,
  type GodraysLight,
} from './useGodraysLight'
