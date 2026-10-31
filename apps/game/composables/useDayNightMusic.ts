import { MathUtils } from 'three'

// Phases from utils/dayCyclePresets.ts: dusk 0.25, night 0.35, dawn 0.8. The night theme
// fades in through dusk and out through dawn.
const NIGHT_IN = [0.22, 0.35] as const
const NIGHT_OUT = [0.75, 0.88] as const
const UPDATE_INTERVAL = 0.25

/** How much of the night theme to play at a day phase, from 0 to 1. */
function nightWeight(phase: number) {
  return MathUtils.smoothstep(phase, ...NIGHT_IN) * (1 - MathUtils.smoothstep(phase, ...NIGHT_OUT))
}

/** Crossfades a day theme and a night theme with the day cycle. */
export function useDayNightMusic(audio: GameAudio, dayPhase: () => number) {
  const day = audio.stream('musicDay')
  const night = audio.stream('musicNight')
  onUnmounted(() => {
    day.stop()
    night.stop()
  })

  let sinceUpdate = UPDATE_INTERVAL
  const { onBeforeRender } = useLoop()
  onBeforeRender(({ delta }) => {
    sinceUpdate += delta
    if (sinceUpdate < UPDATE_INTERVAL) return
    sinceUpdate = 0
    // Equal power: cos² + sin² = 1, so the sum is as loud halfway through as at either end.
    const angle = nightWeight(dayPhase()) * Math.PI / 2
    day.setGain(Math.cos(angle))
    night.setGain(Math.sin(angle))
  })
}
