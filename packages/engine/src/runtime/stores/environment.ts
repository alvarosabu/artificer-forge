import { defineStore } from 'pinia'
import { ref } from 'vue'
import { DEFAULT_WIND_ANGLE, DEFAULT_WIND_STRENGTH } from '../components/wind/wind'

/**
 * Global environment state (wind now, fog/time-of-day/rain later).
 * Smart layers (experiences, weather systems) write here; scene components
 * stay dumb and receive these values as props.
 *
 * `windAngle`/`windStrength` are the CURRENT values components consume.
 * `baseWindAngle`/`baseWindStrength` are the weather targets; `tickWind(delta)`
 * meanders the current values around them (slow direction veer + strength
 * gusts). Call it from a smart layer's render loop. Skip calling it (or set
 * windVariability to 0) for static wind.
 */
export const useEnvironmentStore = defineStore('environment', () => {
    const windAngle = ref(DEFAULT_WIND_ANGLE)
    const windStrength = ref(DEFAULT_WIND_STRENGTH)

    const baseWindAngle = ref(DEFAULT_WIND_ANGLE)
    const baseWindStrength = ref(DEFAULT_WIND_STRENGTH)
    const windVariability = ref(1)

    let windTime = 0

    function setWind(settings: { angle?: number, strength?: number, variability?: number }) {
        if (settings.angle !== undefined) {
            baseWindAngle.value = settings.angle
            windAngle.value = settings.angle
        }
        if (settings.strength !== undefined) {
            baseWindStrength.value = settings.strength
            windStrength.value = settings.strength
        }
        if (settings.variability !== undefined) windVariability.value = settings.variability
    }

    function tickWind(delta: number) {
        windTime += delta
        const v = windVariability.value
        if (v <= 0) return

        // incommensurate sine pairs so the pattern doesn't read as a loop:
        // direction veers ±~0.45 rad over tens of seconds, strength gusts ±~0.25
        const veer = Math.sin(windTime * 0.11) * 0.25 + Math.sin(windTime * 0.047) * 0.2
        const gust = Math.sin(windTime * 0.31) * 0.15 + Math.sin(windTime * 0.13) * 0.1

        windAngle.value = baseWindAngle.value + veer * v
        windStrength.value = Math.min(1, Math.max(0, baseWindStrength.value + gust * v))
    }

    return {
        windAngle,
        windStrength,
        baseWindAngle,
        baseWindStrength,
        windVariability,
        setWind,
        tickWind,
    }
})
