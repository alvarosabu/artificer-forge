import type { Node } from "three/webgpu"
import { cameraPosition, float, Fn, mix, normalWorld, positionWorld, step, vec4 } from "three/tsl"
import { GradingContext } from "./grading"

export interface StylizedOutputOptions {
    hasFog?: boolean
    hasCoreShadows?: boolean
    /** 3-zone ramp (lit / mid / shadow) instead of 2 — for smooth geometry that reads flat on two tones */
    hasMidTone?: boolean
    /** fresnel rim light tinted by lightColor — BOTW-style silhouette pop */
    hasRim?: boolean
    /** stepped toon specular highlight, masked out of the core shadow */
    hasSpecular?: boolean
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
    
    const { lightColor, lightIntensity, lightDirection, shadowEdgeLow, shadowEdgeHigh, shadowColor, midEdgeLow, midEdgeHigh, midStrength, rimStrength, rimPower, specStrength, specShininess, rampHardness } = grading.uniforms

    // Fn wrapper: discard() is a statement — it only registers on an active TSL stack
    return Fn(() => {
        // light tint — grading IS the lighting; adopting materials are unlit
        let out = baseColor.mul(lightColor).mul(lightIntensity)

        const facing = normalNode.dot(lightDirection)
        // rampHardness morphs each band from smoothstep to a hard step() at its
        // center (Wind Waker cel) — uniform-driven so it tunes live, no rebuild
        const ramp = (low: Node<'float'>, high: Node<'float'>) =>
            mix(facing.smoothstep(low, high), step(low.add(high).mul(0.5), facing), rampHardness)
        const shadowMix = ramp(shadowEdgeLow, shadowEdgeHigh)

        // core shadow: surfaces facing away from the light mix toward a COLOR, not darkness
        if (hasCoreShadows) {
            const shadow = baseColor.mul(shadowColor)
            if (options.hasMidTone) {
                // half-shadow band between lit and core shadow — extra form on smooth geometry
                const mid = mix(out, shadow, midStrength)
                out = mix(out, mid, ramp(midEdgeLow, midEdgeHigh))
            }
            out = mix(out, shadow, shadowMix)
        }

        // stepped toon specular: hard-edged highlight, only on the lit side
        if (options.hasSpecular) {
            const viewDir = cameraPosition.sub(positionWorld).normalize()
            const halfDir = viewDir.sub(lightDirection).normalize()
            const specBand = normalNode.dot(halfDir).saturate().pow(specShininess).smoothstep(0.3, 0.5)
            out = out.add(lightColor.mul(specStrength).mul(specBand).mul(shadowMix.oneMinus()))
        }

        // fresnel rim: silhouette edges catch the light color
        if (options.hasRim) {
            const viewDir = cameraPosition.sub(positionWorld).normalize()
            const fresnel = viewDir.dot(normalNode).saturate().oneMinus().pow(rimPower)
            out = out.add(lightColor.mul(rimStrength).mul(fresnel))
        }

        if (hasFog) out = grading.fogStrength.mix(out, grading.fogColor)

        if (options.alphaTest !== undefined) alphaNode.lessThan(options.alphaTest).discard()

        return vec4(out.rgb, alphaNode)
    })()
}