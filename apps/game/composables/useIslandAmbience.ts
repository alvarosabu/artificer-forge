import { useControls } from '@tresjs/leches'
import { Vector3 } from 'three'
import type { Object3D } from 'three'
import type { Ref } from 'vue'
import { REF_DISTANCE, ROLLOFF, type Loop } from '~/composables/useAudio'

const SEA_LEVEL = 0
const SEA_RING_SAMPLES = 16

const CALM_WIND_CUTOFF = 400
const STORM_WIND_CUTOFF = 6000

// The ring reads 16 heights, so 10 times a second is plenty. The smoothing hides the steps.
const UPDATE_INTERVAL = 0.1

// The gap stops a player at the edge of the range from starting and stopping a torch loop on every update.
const TORCH_STOP_GAP = 4
const TORCH_FADE = 0.5

const level = (value: number) => ({ value, min: -40, max: 12, step: 1, type: 'range' })
const metres = (value: number, min: number, max: number) => ({ value, min, max, step: 0.5, type: 'range' })

/** Surf that grows as the sea closes in, wind that follows the wind strength, and fire at each torch near the player. */
export function useIslandAmbience(
  heightAt: (x: number, z: number) => number | null,
  torches: Readonly<Ref<Object3D[]>>,
) {
  const audio = useAudio()
  const player = usePlayerPosition()
  const wind = useWind()

  const uuid = inject<string>('uuid')
  const {
    ambienceSurf,
    ambienceSurfRange,
    ambienceSurfFar,
    ambienceWind,
    ambienceWindCalm,
    ambienceFire,
    ambienceFireRange,
    ambienceFireNear,
    ambienceFireRolloff,
  } = useControls('🌊 ambience', {
    // Level trims in dB, on top of the level each sound has in SOUNDS.
    surf: level(0),
    // How far from the player the sea is heard: the radius of the ring that looks for sea.
    surfRange: metres(12, 2, 40),
    // dB when the first sea enters the ring. The level rises from here to 0 dB when the whole ring is sea.
    surfFar: { value: -24, min: -60, max: 0, step: 1, type: 'range' },
    wind: level(0),
    windCalm: { value: -30, min: -60, max: 0, step: 1, type: 'range' },
    fire: level(6),
    // An HRTF panner costs real CPU, so a torch only plays within this many metres.
    fireRange: metres(16, 4, 60),
    fireNear: metres(REF_DISTANCE, 0.5, 10),
    fireRolloff: { value: ROLLOFF, min: 0.1, max: 5, step: 0.1, type: 'range' },
  }, { uuid })

  const surf = audio.loop('surf')
  const windLoop = audio.loop('wind', { lowpass: true })
  const torchLoops = new Map<Object3D, Loop>()
  onUnmounted(() => {
    surf.stop()
    windLoop.stop()
    for (const fire of torchLoops.values()) fire.stop()
  })

  watch(ambienceFire!, (db) => {
    for (const fire of torchLoops.values()) fire.setVolume(db)
  })
  watch([ambienceFireNear!, ambienceFireRolloff!], ([near, rolloff]) => {
    for (const fire of torchLoops.values()) fire.setFalloff(near, rolloff)
  })

  const torchPosition = new Vector3()
  function updateTorches(x: number, z: number) {
    const range = ambienceFireRange!.value
    for (const torch of torches.value) {
      torch.getWorldPosition(torchPosition)
      const distance = Math.hypot(torchPosition.x - x, torchPosition.z - z)
      const fire = torchLoops.get(torch)
      if (!fire && distance < range) {
        const loop = audio.loop('fire', { position: torchPosition })
        loop.setFalloff(ambienceFireNear!.value, ambienceFireRolloff!.value)
        loop.setVolume(ambienceFire!.value, TORCH_FADE / 4)
        torchLoops.set(torch, loop)
      }
      else if (fire && distance > range + TORCH_STOP_GAP) {
        fire.stop(TORCH_FADE)
        torchLoops.delete(torch)
      }
    }
  }

  /** The share of a ring around the player that is sea: 0 inland, about 0.5 on the beach, 1 out at sea. */
  function seaAround(x: number, z: number, radius: number) {
    let sea = 0
    for (let i = 0; i < SEA_RING_SAMPLES; i++) {
      const angle = (i / SEA_RING_SAMPLES) * Math.PI * 2
      const ground = heightAt(x + Math.cos(angle) * radius, z + Math.sin(angle) * radius)
      // Past the edge of the height field there is only sea.
      if (ground === null || ground < SEA_LEVEL) sea++
    }
    return sea / SEA_RING_SAMPLES
  }

  let sinceUpdate = UPDATE_INTERVAL
  const { onBeforeRender } = useLoop()
  onBeforeRender(({ delta }) => {
    sinceUpdate += delta
    if (sinceUpdate < UPDATE_INTERVAL) return
    sinceUpdate = 0

    const [x, , z] = player.value
    const sea = seaAround(x, z, ambienceSurfRange!.value)
    surf.setVolume(sea > 0 ? ambienceSurf!.value + ambienceSurfFar!.value * (1 - sea) : -Infinity)

    const strength = Math.min(Math.max(wind.strength, 0), 1)
    windLoop.setVolume(ambienceWind!.value + ambienceWindCalm!.value * (1 - strength))
    // Pitch goes by ratios, so equal steps in strength give equal steps in pitch.
    windLoop.setCutoff(CALM_WIND_CUTOFF * (STORM_WIND_CUTOFF / CALM_WIND_CUTOFF) ** strength)

    updateTorches(x, z)
  })
}
