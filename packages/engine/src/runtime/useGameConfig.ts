// provideGameConfig() must run above <Game>, which reads it with useGameConfig().

import { inject, provide, reactive, type InjectionKey } from 'vue'

export interface BloomConfig {
  strength: number
  radius: number
  threshold: number
  smoothWidth: number
  /** Bloom mip-chain scale: 1 = three's stock half-res chain, 0.5 = quarter res. */
  resolutionScale: number
}

export interface DofConfig {
  enabled: boolean
  /** Depth band (world units) around the focus plane before a fragment is fully blurred. */
  focalLength: number
  bokehScale: number
  /** Focus depth when nothing has claimed the focus. */
  focusDistance: number
  /** Added to the focus target's Y (character origin is at the feet). */
  focusHeight: number
  smoothing: number
  /** Scale of the CoC + bokeh passes. 0.5 ~ three's stock chain, 0.25 = quarter res. */
  resolutionScale: number
}

export interface TiltShiftConfig {
  enabled: boolean
  /** Screen height of the sharp line, 0 = bottom, 1 = top. */
  focusCenter: number
  /** Half-height of the fully sharp band, in screen fractions. */
  bandWidth: number
  /** Ramp length from sharp to fully blurred, in screen fractions. */
  feather: number
  /** Blur radius multiplier. */
  strength: number
  /** Depth band (world units) around the focus depth that stays sharp inside the ramp. */
  focalRange: number
  /** Focus depth when nothing has claimed the focus. */
  focusDistance: number
  /** Added to the focus target's Y (character origin is at the feet). */
  focusHeight: number
  smoothing: number
  /** Kernel taps = 3 + 2·sigma. Changing it rebuilds the pipeline. */
  sigma: number
  /** Scale of the blur passes; the sharp band stays full-res. */
  resolutionScale: number
}

export interface GodraysConfig {
  enabled: boolean
  /** How much light the air accumulates per world unit marched. */
  density: number
  /** Upper clamp on the accumulated ray brightness (0-1). */
  maxDensity: number
  /** How fast rays fade with distance from the light. Higher = shorter rays. */
  distanceAttenuation: number
  /** Samples per pixel through the shadow map. The main cost knob. */
  raymarchSteps: number
  /** Ray tint composited over the scene. */
  color: string
  /** Pixel search radius for depth edges in the composite. Changing it rebuilds the pipeline. */
  edgeRadius: number
  /** How far the composite pushes samples away from depth edges (anti-halo). */
  edgeStrength: number
  /** Bilateral blur kernel over the raymarch result. Changing it rebuilds the pipeline. */
  blurSigma: number
  /** Scale of the raymarch target. */
  resolutionScale: number
}

export interface OutlinePreset {
  visibleEdgeColor: string
  edgeThickness: number
}

/** Must match EffectComposer's AntialiasMode. */
export type AntialiasMode = 'msaa' | 'fxaa' | 'none'

export interface GameConfig {
  antialias: AntialiasMode
  bloom: BloomConfig
  dof: DofConfig
  tiltShift: TiltShiftConfig
  godrays: GodraysConfig
  outlinePresets: Record<string, OutlinePreset>
}

const GAME_CONFIG_KEY: InjectionKey<GameConfig> = Symbol('af-game-config')

export function defaultGameConfig(): GameConfig {
  return {
    antialias: 'msaa',
    bloom: { strength: 0.7, radius: 0.4, threshold: 0.8, smoothWidth: 0.3, resolutionScale: 0.5 },
    // Off by default: a top-down camera puts the whole play area near one depth,
    // so DOF reads as tilt-shift.
    dof: { enabled: false, focalLength: 6, bokehScale: 2, focusDistance: 15, focusHeight: 1, smoothing: 8, resolutionScale: 0.25 },
    // The screen-space miniature take on the same idea. Off by default; enable one of the two, not both.
    tiltShift: { enabled: false, focusCenter: 0.5, bandWidth: 0.1, feather: 0.35, strength: 1, focalRange: 12, focusDistance: 15, focusHeight: 1, smoothing: 8, sigma: 8, resolutionScale: 0.5 },
    // Also needs a shadow-casting light registered via useGodraysLight from the scene.
    godrays: { enabled: false, density: 0.7, maxDensity: 0.5, distanceAttenuation: 2, raymarchSteps: 60, color: '#fff3d6', edgeRadius: 2, edgeStrength: 2, blurSigma: 4, resolutionScale: 0.5 },
    outlinePresets: {
      party: { visibleEdgeColor: '#00e5ff', edgeThickness: 3 },
      interactive: { visibleEdgeColor: '#ffcc00', edgeThickness: 3 },
      hostile: { visibleEdgeColor: '#ff4444', edgeThickness: 3 },
      neutral: { visibleEdgeColor: '#ffffff', edgeThickness: 3 },
      ally: { visibleEdgeColor: '#00e5ff', edgeThickness: 3 },
    },
  }
}

/** Returns the reactive object so a debug GUI can keep mutating it after provide. */
export function provideGameConfig(overrides: Partial<GameConfig> = {}): GameConfig {
  const base = defaultGameConfig()
  const config = reactive<GameConfig>({
    antialias: overrides.antialias ?? base.antialias,
    bloom: { ...base.bloom, ...overrides.bloom },
    dof: { ...base.dof, ...overrides.dof },
    tiltShift: { ...base.tiltShift, ...overrides.tiltShift },
    godrays: { ...base.godrays, ...overrides.godrays },
    outlinePresets: { ...base.outlinePresets, ...overrides.outlinePresets },
  })
  provide(GAME_CONFIG_KEY, config)
  return config
}

export function useGameConfig(): GameConfig {
  return inject(GAME_CONFIG_KEY, undefined) ?? reactive(defaultGameConfig())
}
