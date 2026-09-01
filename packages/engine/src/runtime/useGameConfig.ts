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
    outlinePresets: { ...base.outlinePresets, ...overrides.outlinePresets },
  })
  provide(GAME_CONFIG_KEY, config)
  return config
}

export function useGameConfig(): GameConfig {
  return inject(GAME_CONFIG_KEY, undefined) ?? reactive(defaultGameConfig())
}
