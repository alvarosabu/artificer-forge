export { default as EffectComposer } from './EffectComposer.vue'
export type { AntialiasMode, BloomConfig, DofConfig, OutlinePreset } from './EffectComposer.vue'
export { ScaledBloomNode, scaledBloom } from './ScaledBloomNode'
export { ScaledDepthOfFieldNode, scaledDof } from './ScaledDepthOfFieldNode'
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
