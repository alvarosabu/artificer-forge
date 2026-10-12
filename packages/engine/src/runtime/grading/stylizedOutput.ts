import type { Node } from "three/webgpu"
import { cameraPosition, float, Fn, Loop, mix, normalWorld, positionWorld, sin, step, time, vec3, vec4 } from "three/tsl"
import { GradingContext } from "./grading"

export interface StylizedOutputOptions {
    hasFog?: boolean
    hasCoreShadows?: boolean
    /** catched shadow-map factor from createDropShadowCatcher (1 = lit, 0 = shadowed) — folds into the shadow band */
    dropShadowNode?: Node<'float'>
    /** 3-zone ramp (lit / mid / shadow) instead of 2 — for smooth geometry that reads flat on two tones */
    hasMidTone?: boolean
    /** fresnel rim light tinted by lightColor — BOTW-style silhouette pop */
    hasRim?: boolean
    /** stepped toon specular highlight, masked out of the core shadow */
    hasSpecular?: boolean
    /** world-space normal for the core shadow; defaults to normalWorld */
    normalNode?: Node<'vec3'>
    /** occlusion term, 1 = open / 0 = occluded — folds into the shadow band (tints toward shadowColor, never black) */
    aoNode?: Node<'float'>
    alphaNode?: Node<'float'>
    /** discard threshold applied AFTER fog (cutout edges must not pop against fog) */
    alphaTest?: number
    /** add the grading's point lights (torch pools). Off for the light sources themselves */
    hasPointLights?: boolean
}

/**
 * Shadow-map catcher: assign `receivedShadowNode` to the material and pass
 * `shadowFactor` as stylizedOutput's dropShadowNode. Shadow sampling only runs
 * inside a LIT material's lighting pipeline, so adopters must be
 * MeshLambertNodeMaterial — the lambert lighting result itself is discarded by
 * the finish's outputNode; the material is lit ONLY so this catcher executes.
 * Returning 1 neutralizes the built-in black multiply; the finish re-applies
 * the shadow as a tint toward shadowColor instead.
 */
export function createDropShadowCatcher() {
    const shadowFactor = float(1).toVar()
    return {
        shadowFactor,
        receivedShadowNode: Fn(([shadow]: [any]) => {
            shadowFactor.mulAssign(shadow.r)
            return float(1)
        }),
    }
}

export function stylizedOutput(baseColor: any, grading: GradingContext, options: StylizedOutputOptions = {}): Node<'vec4'> {
    const {
        hasFog = true,
        hasCoreShadows = true,
        hasPointLights = true,
        normalNode = normalWorld,
        alphaNode = float(1),
    } = options
    
    const { lightColor, lightIntensity, lightDirection, shadowEdgeLow, shadowEdgeHigh, shadowColor, midEdgeLow, midEdgeHigh, midStrength, rimStrength, rimPower, specStrength, specShininess, rampHardness, aoStrength } = grading.uniforms

    // Fn wrapper: discard() is a statement — it only registers on an active TSL stack
    return Fn(() => {
        // light tint — grading IS the lighting; adopting materials are unlit
        let out = baseColor.mul(lightColor).mul(lightIntensity)

        const facing = normalNode.dot(lightDirection)
        // rampHardness morphs each band from smoothstep to a hard step() at its
        // center (Wind Waker cel) — uniform-driven so it tunes live, no rebuild
        const ramp = (low: Node<'float'>, high: Node<'float'>) =>
            mix(facing.smoothstep(low, high), step(low.add(high).mul(0.5), facing), rampHardness)
        let shadowMix = hasCoreShadows ? ramp(shadowEdgeLow, shadowEdgeHigh) : float(0)
        // fake AO: occluded pixels fall into the SAME shadow band — palette stays
        // two-tone and AO re-grades with the cycle (a black multiply wouldn't)
        if (options.aoNode) shadowMix = shadowMix.max(options.aoNode.oneMinus().mul(aoStrength))
        // drop shadows (shadow map) join the same band — cast shadows match core shadows
        if (options.dropShadowNode) shadowMix = shadowMix.max(options.dropShadowNode.oneMinus())

        // core shadow: surfaces facing away from the light mix toward a COLOR, not darkness
        if (hasCoreShadows || options.aoNode || options.dropShadowNode) {
            const shadow = baseColor.mul(shadowColor)
            if (hasCoreShadows && options.hasMidTone) {
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

        if (hasPointLights) {
            const { pointLights, pointLightColors, pointLightCount, pointLightIntensity } = grading.uniforms
            const tint = vec3(0).toVar()
            const coverage = float(0).toVar()
            Loop(pointLightCount, ({ i }: { i: Node<'int'> }) => {
                const light = pointLights.element(i) as unknown as Node<'vec4'>
                const color = pointLightColors.element(i) as unknown as Node<'vec4'>
                const toLight = light.xyz.sub(positionWorld)
                const distance = toLight.length()
                const falloff = distance.div(light.w).smoothstep(0, 1).oneMinus()
                // half-lambert: the pool wraps round the form instead of cutting a hard terminator
                const facing = normalNode.dot(toLight.div(distance.max(1e-4))).mul(0.5).add(0.5)
                const phase = time.add(float(i).mul(1.7))
                const flicker = sin(phase.mul(11)).mul(sin(phase.mul(7.3))).mul(color.w).add(1)
                const weight = falloff.mul(facing).mul(flicker)
                tint.addAssign(color.rgb.mul(weight))
                coverage.addAssign(weight)
            })
            // after fog, like the unfogged flames. Replaces the time-of-day light: added on top, warm over a blue night reads pink
            const lit = baseColor.mul(tint.div(coverage.max(1e-4)))
            out = mix(out, lit, coverage.saturate().mul(pointLightIntensity))
        }

        // An alphaTest cutout is binary coverage: the pixels that survive are fully
        // opaque. Passing the smooth alpha through instead leaks it to the canvas
        // alpha channel, and a premultiplied canvas (alpha: true) then composites the
        // PAGE background through every cutout edge — white halos around every leaf.
        if (options.alphaTest !== undefined) {
            alphaNode.lessThan(options.alphaTest).discard()
            return vec4(out.rgb, 1)
        }

        return vec4(out.rgb, alphaNode)
    })()
}