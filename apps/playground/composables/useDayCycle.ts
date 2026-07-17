import { Spherical } from "three"
import { createPhaseTween, createPresetTrack, useEnvironmentStore, type GradingProps } from "@artificer-forge/engine/runtime"
import { DAY_CYCLE_NAMES, DAY_CYCLE_STOPS, DAY_CYCLE_TRACK, type DayCycleName } from "~/utils/dayCiclePresets"

// sun peaks (lowest phi) at phase 0, the day stop: cos(-(0 + 0.5) * 2π) = -1
const SUN_PHASE_OFFSET = 0.5

export function useDayCycle() {
    const environment = useEnvironmentStore()
    const phase = ref(0)
    const track = createPresetTrack(DAY_CYCLE_TRACK.presets, DAY_CYCLE_TRACK.stops)
    const tween = createPhaseTween()
    // reusable sample target: no allocation in the render loop
    const current: GradingProps = track.sample(0)

    // automatic time passing: phase loops once per `duration` seconds (Bruno's
    // 4-minute day). Gameplay-delta driven, NOT wall clock — pausing pauses time
    const auto = { running: true, duration: 240 }

    // Bruno-style sun orbit: direction comes from a continuous spherical path
    // driven by the phase, NOT from lerping preset vectors (a vector lerp cuts a
    // chord through the sky dome and collapses near zero mid-transition).
    // theta sweeps ±thetaAmplitude around the day (shadows rotate), phi rides a
    // half-cosine (sun high at noon = short shadows, low at dawn/dusk = long)
    const sun = {
        orbit: true,
        theta: Math.PI / 4, // azimuth at noon — matches the old static (-1,-1,-1) diagonal
        phi: 0.63,
        thetaAmplitude: 1.25,
        phiAmplitude: 0.62,
    }
    const spherical = new Spherical(1)

    function updateSun() {
        if (!sun.orbit) return // presets' static lightDirection stays in effect
        const angle = -(phase.value + SUN_PHASE_OFFSET) * Math.PI * 2
        spherical.theta = sun.theta + Math.sin(angle) * sun.thetaAmplitude
        // clamped above the horizon: phi ≥ π/2 puts the sun underground and
        // kills the shadow map even if the sliders ask for it
        spherical.phi = Math.min(Math.max(sun.phi + Math.cos(angle) * 0.5 * sun.phiAmplitude, 0.05), 1.45)
        // spherical points scene → sun; grading wants light → scene, so negate
        current.lightDirection.setFromSpherical(spherical).normalize().negate()
    }

    function setPhase(value: number) {
        phase.value = value
    }

    function transitionTo(target: DayCycleName | number, options: { duration?: number } = {}) {
        const toPhase = typeof target === 'number'
            ? target
            : DAY_CYCLE_STOPS[DAY_CYCLE_NAMES.indexOf(target)]! // names and stops are parallel consts
        tween.start(phase.value, toPhase, options.duration ?? 2)
    }

    function tick(delta: number) {
        const next = tween.tick(delta)
        // manual transitions win; auto resumes from wherever the tween landed
        if (next !== null) phase.value = next
        else if (auto.running) phase.value = ((phase.value + delta / auto.duration) % 1 + 1) % 1
        // sample every frame (cheap) so manual scrubbing works without a tween
        track.sample(phase.value, current)
        updateSun() // AFTER sample: the orbit overrides the presets' lightDirection
        environment.setGrading(current)
    }

    return { phase, setPhase, transitionTo, tick, sun, auto }
}