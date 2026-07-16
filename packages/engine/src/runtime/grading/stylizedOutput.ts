import type { Node } from "three/webgpu"
import { float, Fn, mix, normalWorld, vec4 } from "three/tsl"
import { GradingContext } from "./grading"

export interface StylizedOutputOptions {
    hasFog?: boolean
    hasCoreShadows?: boolean
    /** world-space normal for the core shadow; defaults to normalWorld */
    normalNode?: Node<'vec3'>
    alphaNode?: Node<'float'>
    /** discard threshold applied AFTER fog (cutout edges must not pop against fog) */
    alphaTest?: number
}

export function stylizedOutput(baseColor: any, grading: GradingContext, options: StylizedOutputOptions = {}): Node<'vec4'> {
    const {
        hasFog = true,
        hasCoreShadows = true,
        normalNode = normalWorld,
        alphaNode = float(1),
    } = options
    
    const { lightColor, lightIntensity, lightDirection, shadowEdgeLow, shadowEdgeHigh, shadowColor } = grading.uniforms

    // Fn wrapper: discard() is a statement — it only registers on an active TSL stack
    return Fn(() => {
        // light tint — grading IS the lighting; adopting materials are unlit
        let out = baseColor.mul(lightColor).mul(lightIntensity)

        // core shadow: surfaces facing away from the light mix toward a COLOR, not darkness
        if (hasCoreShadows) {
            const shadowMix = normalNode.dot(lightDirection).smoothstep(shadowEdgeLow, shadowEdgeHigh)
            out = mix(out, baseColor.mul(shadowColor), shadowMix)
        }

        if (hasFog) out = grading.fogStrength.mix(out, grading.fogColor)

        if (options.alphaTest !== undefined) alphaNode.lessThan(options.alphaTest).discard()

        return vec4(out.rgb, alphaNode)
    })()
}