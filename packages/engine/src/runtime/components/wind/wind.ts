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
