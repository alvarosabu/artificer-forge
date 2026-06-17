// Game scene configuration shared between the engine's <Game> host and the app.
// The engine ships sane defaults; the app overrides them (e.g. from a debug GUI)
// via provideGameConfig() at a level above <Game>, which reads it with useGameConfig().

import { inject, provide, reactive, type InjectionKey } from 'vue'

export interface BloomConfig {
  strength: number
  radius: number
  threshold: number
  smoothWidth: number
}

export interface OutlinePreset {
  visibleEdgeColor: string
  edgeThickness: number
}

export interface GameConfig {
  bloom: BloomConfig
  outlinePresets: Record<string, OutlinePreset>
}

const GAME_CONFIG_KEY: InjectionKey<GameConfig> = Symbol('af-game-config')

export function defaultGameConfig(): GameConfig {
  return {
    bloom: { strength: 0.7, radius: 0.4, threshold: 0.8, smoothWidth: 0.3 },
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
    bloom: { ...base.bloom, ...overrides.bloom },
    outlinePresets: { ...base.outlinePresets, ...overrides.outlinePresets },
  })
  provide(GAME_CONFIG_KEY, config)
  return config
}

/** Read the provided GameConfig, falling back to engine defaults when none is provided. */
export function useGameConfig(): GameConfig {
  return inject(GAME_CONFIG_KEY, undefined) ?? reactive(defaultGameConfig())
}
