import type { Node } from "three/webgpu"
import { float, Fn, mix, normalWorld, vec4 } from "three/tsl"
import { GradingContext } from "./grading"

export interface StylizedOutputOptions {
    hasFog?: boolean
    hasCoreShadows?: boolean
    /** 3-zone ramp (lit / mid / shadow) instead of 2 — for smooth geometry that reads flat on two tones */
    hasMidTone?: boolean
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
    
    const { lightColor, lightIntensity, lightDirection, shadowEdgeLow, shadowEdgeHigh, shadowColor, midEdgeLow, midEdgeHigh, midStrength } = grading.uniforms

    // Fn wrapper: discard() is a statement — it only registers on an active TSL stack
    return Fn(() => {
        // light tint — grading IS the lighting; adopting materials are unlit
        let out = baseColor.mul(lightColor).mul(lightIntensity)

        // core shadow: surfaces facing away from the light mix toward a COLOR, not darkness
        if (hasCoreShadows) {
            const facing = normalNode.dot(lightDirection)
            const shadow = baseColor.mul(shadowColor)
            if (options.hasMidTone) {
                // half-shadow band between lit and core shadow — extra form on smooth geometry
                const mid = mix(out, shadow, midStrength)
                out = mix(out, mid, facing.smoothstep(midEdgeLow, midEdgeHigh))
            }
            out = mix(out, shadow, facing.smoothstep(shadowEdgeLow, shadowEdgeHigh))
        }

        if (hasFog) out = grading.fogStrength.mix(out, grading.fogColor)

        if (options.alphaTest !== undefined) alphaNode.lessThan(options.alphaTest).discard()

        return vec4(out.rgb, alphaNode)
    })()
}