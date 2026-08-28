// Game scene configuration shared between the engine's <Game> host and the app.
// The engine ships sane defaults; the app overrides them (e.g. from a debug GUI)
// via provideGameConfig() at a level above <Game>, which reads it with useGameConfig().

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
  /** Blur radius multiplier. */
  bokehScale: number
  /** Fallback focus depth when nothing has claimed the focus (no party leader in scene). */
  focusDistance: number
  /** Y offset added to the focus target origin (character origin is at the feet). */
  focusHeight: number
  /** Exponential smoothing rate for the tracked focus depth. */
  smoothing: number
  /** Scale of the CoC + bokeh passes. 0.5 ~ three's stock chain, 0.25 = quarter res. */
  resolutionScale: number
}

export interface OutlinePreset {
  visibleEdgeColor: string
  edgeThickness: number
}

/** See EffectComposer's AntialiasMode: msaa = 4x on the scene pass (expensive), fxaa = cheap post AA, none. */
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
    // Off by default: on a top-down camera the whole play area sits near one depth,
    // so DOF reads as tilt-shift. Scenes opt in and tune the band per look.
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

/**
 * Provide a reactive GameConfig to descendant <Game> hosts. Returns the reactive
 * object so callers can keep its fields in sync with their own sources (debug GUI,
 * settings store, …). Omitted fields fall back to engine defaults.
 */
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

/** Read the provided GameConfig, falling back to engine defaults when none is provided. */
export function useGameConfig(): GameConfig {
  return inject(GAME_CONFIG_KEY, undefined) ?? reactive(defaultGameConfig())
}
