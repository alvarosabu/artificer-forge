import { Vector2 } from 'three'
import { Fn, mx_noise_float, uniform } from 'three/tsl'
import type { Node } from 'three/webgpu'

export const DEFAULT_WIND_ANGLE = Math.PI * 0.6
export const DEFAULT_WIND_STRENGTH = 0.5
export const DEFAULT_WIND_TIME_FREQUENCY = 0.5

export interface WindSettings {
    windAngle?: number
    windStrength?: number
    windTimeFrequency?: number
}

export function createWindUniforms(settings: WindSettings = {}) {
    const angle = settings.windAngle ?? DEFAULT_WIND_ANGLE
    return {
        direction: uniform(new Vector2(Math.sin(angle), Math.cos(angle))),
        positionFrequency: uniform(0.5),
        strength: uniform(settings.windStrength ?? DEFAULT_WIND_STRENGTH),
        timeFrequency: uniform(settings.windTimeFrequency ?? DEFAULT_WIND_TIME_FREQUENCY),
        localTime: uniform(0),
    }
}

export type WindUniforms = ReturnType<typeof createWindUniforms>

// localTime accumulates scaled by strength so wind speed responds to the slider
export function advanceWindTime(wind: WindUniforms, delta: number) {
    wind.localTime.value += delta * wind.timeFrequency.value * wind.strength.value
}

/**
 * Weather drift on top of a base wind, for CPU-side wind state. `variability` 0 is static wind.
 * Incommensurate sine pairs so the pattern does not read as a loop: direction veers
 * ±~0.45 rad over tens of seconds, strength gusts ±~0.25.
 */
export function sampleWindGust(time: number, base: { angle: number, strength: number }, variability: number) {
    const veer = Math.sin(time * 0.11) * 0.25 + Math.sin(time * 0.047) * 0.2
    const gust = Math.sin(time * 0.31) * 0.15 + Math.sin(time * 0.13) * 0.1
    return {
        angle: base.angle + veer * variability,
        strength: Math.min(1, Math.max(0, base.strength + gust * variability)),
    }
}

// 2 octaves of scrolled perlin. mx_noise_float is already centered on 0,
// so no [0,1] → [-0.5,0.5] remap. Octaves MUST keep different frequencies
// and time scales (0.2/1× vs 0.1/0.2×) or the wind reads as one marching wave.
// The 0.4 constant is a downwind lean: real wind bows vegetation, it doesn't
// just oscillate it around rest pose.
export function windOffset(wind: WindUniforms) {
    return Fn(([pos]: [Node<'vec2'>]) => {
        const p = pos.mul(wind.positionFrequency)
        const n1 = mx_noise_float(p.mul(0.2).add(wind.direction.mul(wind.localTime)))
        const n2 = mx_noise_float(p.mul(0.1).add(wind.direction.mul(wind.localTime.mul(0.2)))).mul(0.5)
        const intensity = n1.add(n2).add(0.4)
        return wind.direction.mul(intensity).mul(wind.strength)
    })
}
