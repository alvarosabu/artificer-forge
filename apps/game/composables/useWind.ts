import type { InjectionKey } from 'vue'
import { DEFAULT_WIND_ANGLE, DEFAULT_WIND_STRENGTH, sampleWindGust } from '@artificer-forge/engine/runtime'

// Same shape as useGrading: one wind per scene, owned by <EnvironmentController>.
// The engine's useEnvironmentStore holds the same state, but it needs Pinia, which the game does not use.
export function createWind() {
  const state = reactive({
    // what the panel sets
    baseAngle: DEFAULT_WIND_ANGLE,
    baseStrength: DEFAULT_WIND_STRENGTH,
    variability: 1,
    // what the scene reads: the base plus the gusts
    angle: DEFAULT_WIND_ANGLE,
    strength: DEFAULT_WIND_STRENGTH,
  })
  let time = 0

  function tick(delta: number) {
    time += delta
    const wind = sampleWindGust(time, { angle: state.baseAngle, strength: state.baseStrength }, state.variability)
    state.angle = wind.angle
    state.strength = wind.strength
  }

  return { state, tick }
}

export type Wind = ReturnType<typeof createWind>
type WindState = Wind['state']

const WindKey: InjectionKey<WindState> = Symbol('wind')

export function provideWind(wind: Wind) {
  provide(WindKey, wind.state)
}

export function useWind() {
  const wind = inject(WindKey, null)
  if (!wind) throw new Error('useWind() needs an <EnvironmentController> ancestor')
  return wind
}
