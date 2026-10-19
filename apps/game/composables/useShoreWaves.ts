import type { InjectionKey } from 'vue'

// One set per island: the ocean lifts the water and the terrain wets the sand from the same uniforms.
const ShoreWavesKey: InjectionKey<ShoreWaves> = Symbol('shore-waves')

export function provideShoreWaves(waves: ShoreWaves) {
  provide(ShoreWavesKey, waves)
}

export function useShoreWaves() {
  const waves = inject(ShoreWavesKey, null)
  if (!waves) throw new Error('useShoreWaves() needs provideShoreWaves() in an ancestor')
  return waves
}
