import { Color, Vector3 } from 'three'
import type { GradingProps } from '@artificer-forge/engine/runtime'

export const DAY_CYCLE_NAMES = ['day', 'dusk', 'night', 'dawn'] as const
export type DayCycleName = typeof DAY_CYCLE_NAMES[number]

export const DAY_CYCLE_STOPS = [0, 0.25, 0.5, 0.75]

const sun = new Vector3(-1, -1, -1).normalize()

export const dayCyclePresets: GradingProps[] = [
    { // day
        lightDirection: sun.clone(),
        lightColor: new Color('#ffd2c2'),
        lightIntensity: 1.2,
        shadowColor: new Color('#7fb8c4'), // sky-teal day shadow (shadow = sky ambient); multiplier, so keep it bright + desaturated
        fogColorA: new Color('#00ffff'),
        fogColorB: new Color('#9b89ff'),
        fogNearRatio: 0.315,
        fogFarRatio: 1.25,
    },
    { // dusk
        lightDirection: sun.clone(),
        lightColor: new Color('#ff8181'),
        lightIntensity: 1.2,
        shadowColor: new Color('#4e009c'),
        fogColorA: new Color('#3e53ff'),
        fogColorB: new Color('#ff4ce4'),
        fogNearRatio: 0,
        fogFarRatio: 1.25,
    },
    { // night — negative near ratio: fog plane starts behind the camera, heavy haze
        lightDirection: sun.clone(),
        lightColor: new Color('#3240ff'),
        lightIntensity: 1.6,
        shadowColor: new Color('#2f00db'),
        fogColorA: new Color('#10266f'),
        fogColorB: new Color('#490a42'),
        fogNearRatio: -0.85,
        fogFarRatio: 1,
    },
    { // dawn
        lightDirection: sun.clone(),
        lightColor: new Color('#ffa882'),
        lightIntensity: 1.2,
        shadowColor: new Color('#db004f'),
        fogColorA: new Color('#f885ff'),
        fogColorB: new Color('#ff7d24'),
        fogNearRatio: 0.3,
        fogFarRatio: 1.25,
    },
]