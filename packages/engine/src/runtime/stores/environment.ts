import { defineStore } from 'pinia'
import { ref } from 'vue'
import { DEFAULT_WIND_ANGLE, DEFAULT_WIND_STRENGTH } from '../components/wind/wind'
import { Color, Vector3 } from 'three'
import type { GradingProps } from '../grading/grading'

/**
 * Global environment state (wind + grading now, rain later).
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
    // Wind
    const windAngle = ref(DEFAULT_WIND_ANGLE)
    const windStrength = ref(DEFAULT_WIND_STRENGTH)
    const baseWindAngle = ref(DEFAULT_WIND_ANGLE)
    const baseWindStrength = ref(DEFAULT_WIND_STRENGTH)
    const windVariability = ref(1)
    let windTime = 0

    // Grading
    const lightDirection = ref(new Vector3(-1, -1, -1).normalize())
    const lightColor = ref(new Color('#ffffff'))
    const lightIntensity = ref(1)
    const shadowColor = ref(new Color('#000000'))
    const fogColorA = ref(new Color('#88aaff'))
    const fogColorB = ref(new Color('#4455aa'))
    const fogNearRatio = ref(0.3)
    const fogFarRatio = ref(1)

    function setGrading(props: Partial<GradingProps>) {

        if (props.lightDirection) lightDirection.value.copy(props.lightDirection)
        if (props.lightColor) lightColor.value.copy(props.lightColor)
        if (props.lightIntensity !== undefined) lightIntensity.value = props.lightIntensity
        if (props.shadowColor) shadowColor.value.copy(props.shadowColor)
        if (props.fogColorA) fogColorA.value.copy(props.fogColorA)
        if (props.fogColorB) fogColorB.value.copy(props.fogColorB)
        if (props.fogNearRatio !== undefined) fogNearRatio.value = props.fogNearRatio
        if (props.fogFarRatio !== undefined) fogFarRatio.value = props.fogFarRatio
    }
    
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
        lightDirection,
        lightColor,
        lightIntensity,
        shadowColor,
        fogColorA,
        fogColorB,
        fogNearRatio,
        fogFarRatio,
        setGrading,
    }
})
