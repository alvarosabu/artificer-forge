import { Spherical } from 'three'
import { createPhaseTween, createPresetTrack, wrap01 } from '@artificer-forge/engine/runtime'
import type { GradingProps } from '@artificer-forge/engine/runtime'
import { DAY_CYCLE_NAMES, DAY_CYCLE_STOPS, DAY_CYCLE_TRACK } from '~/utils/dayCyclePresets'
import type { DayCycleName } from '~/utils/dayCyclePresets'

// sun peaks (lowest phi) at phase 0, the day stop: cos(-(0 + 0.5) * 2π) = -1
const SUN_PHASE_OFFSET = 0.5

// Port of the playground driver without the environment store: the game has no
// Pinia yet, so the sampled props are returned and the caller syncs grading.
export function useDayCycle() {
  const phase = ref(0)
  const track = createPresetTrack(DAY_CYCLE_TRACK.presets, DAY_CYCLE_TRACK.stops)
  const tween = createPhaseTween()
  // reusable sample target: no allocation in the render loop
  const current: GradingProps = track.sample(0)

  // Gameplay-delta driven, not wall clock: pausing the loop pauses time.
  const auto = { running: true, duration: 240 }

  // Bruno-style sun orbit on a spherical path. Lerping preset vectors would cut
  // a chord through the sky dome and collapse near zero mid-transition.
  const sun = {
    orbit: true,
    theta: Math.PI / 4,
    phi: 0.63,
    thetaAmplitude: 1.25,
    phiAmplitude: 0.62,
  }
  const spherical = new Spherical(1)

  function updateSun() {
    if (!sun.orbit) return
    const angle = -(phase.value + SUN_PHASE_OFFSET) * Math.PI * 2
    spherical.theta = sun.theta + Math.sin(angle) * sun.thetaAmplitude
    // phi ≥ π/2 puts the sun underground and kills the shadow map
    spherical.phi = Math.min(Math.max(sun.phi + Math.cos(angle) * 0.5 * sun.phiAmplitude, 0.05), 1.45)
    // spherical points scene → sun; grading wants light → scene
    current.lightDirection.setFromSpherical(spherical).normalize().negate()
  }

  function transitionTo(target: DayCycleName | number, options: { duration?: number } = {}) {
    const toPhase = typeof target === 'number'
      ? target
      : DAY_CYCLE_STOPS[DAY_CYCLE_NAMES.indexOf(target)]!
    tween.start(phase.value, toPhase, options.duration ?? 2)
  }

  function tick(delta: number) {
    const next = tween.tick(delta)
    // manual transitions win; auto resumes from wherever the tween landed
    if (next !== null) phase.value = next
    else if (auto.running) phase.value = wrap01(phase.value + delta / auto.duration)
    track.sample(phase.value, current)
    updateSun() // after sample: the orbit overrides the presets' lightDirection
  }

  return { phase, current, transitionTo, tick, sun, auto }
}
