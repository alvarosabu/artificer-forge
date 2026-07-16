import { createPhaseTween, createPresetTrack, useEnvironmentStore, type GradingProps } from "@artificer-forge/engine/runtime"
import { DAY_CYCLE_NAMES, DAY_CYCLE_STOPS, dayCyclePresets, type DayCycleName } from "~/utils/dayCiclePresets"

export function useDayCycle() {
    const environment = useEnvironmentStore()
    const phase = ref(0)
    const track = createPresetTrack(dayCyclePresets, DAY_CYCLE_STOPS)
    const tween = createPhaseTween()
    // reusable sample target: no allocation in the render loop
    const current: GradingProps = track.sample(0)

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
        if (next !== null) phase.value = next
        // sample every frame (cheap) so manual scrubbing works without a tween
        environment.setGrading(track.sample(phase.value, current))
    }

    return { phase, setPhase, transitionTo, tick }
}