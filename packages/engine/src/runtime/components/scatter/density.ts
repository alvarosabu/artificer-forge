import { mix, texture } from 'three/tsl'
import type { Node, TextureNode, UniformNode } from 'three/webgpu'
import type { Texture } from 'three'
import { CONTROL_CHANNEL, controlUv, readControlPixels, sampleControlChannel, type ControlMap } from '../../terrain/controlMap'

/**
 * Shared coverage test for scattered vegetation (flowers, grass tufts).
 *
 * Where a species grows = the terrain's painted grass channel × baked patch
 * noise, evaluated in the vertex stage. The control map is the SAME mask the
 * ground material blends grass with, so vegetation stops at the road and the
 * water for free — no second texture to keep in sync. Patch noise on top is what
 * makes beds and clumps instead of an even sprinkle.
 *
 * An extra `densityMap` can narrow it further (one species per channel, like a
 * terrain weightmap) once there is one painted.
 *
 * Two ways to apply it. `createScatterBake` (below) evaluates coverage on the
 * CPU, sorts the instances by it, and lets the caller draw only the passing
 * prefix — no vertex work for a reject. When that declines, callers fall back to
 * multiplying their local vertex position by `step(threshold, coverage)` so
 * rejects collapse to zero area, which costs a full vertex invocation each.
 */

/** one species per channel, the way a terrain weightmap packs layers */
export type DensityChannel = 'r' | 'g' | 'b' | 'a'

export function channelNode(node: TextureNode, channel: DensityChannel) {
    if (channel === 'g') return node.g
    if (channel === 'b') return node.b
    if (channel === 'a') return node.a
    return node.r
}

/**
 * world XZ ∈ [-size/2, size/2] → map UV [0, 1], same mapping as the grass splat.
 *
 * Sampled at the position the instance actually stands on, not at its grid anchor:
 * on a following field those differ by whole field widths (see scatter/focus), and
 * a painted mask is painted over the LEVEL, so `size` is the map's world extent
 * rather than the field's.
 */
export function createDensityMapNode(map: Texture | null | undefined, worldXZ: Node<'vec2'>, size: number) {
    if (!map) return null
    return texture(map, worldXZ.div(size).add(0.5))
}

/**
 * The terrain's grass channel, ramped across a low/high band — identical to the
 * test in grass.ts, so blades and flowers agree on where grass ends.
 */
export function controlMaskNode(
    control: ControlMap,
    worldXZ: Node<'vec2'>,
    low?: UniformNode<'float', number> | null,
    high?: UniformNode<'float', number> | null,
) {
    return texture(control.texture, controlUv(control.uniforms, worldXZ)).g.smoothstep(low, high)
}

export interface CoverageOptions {
    /** anchor of this instance in world XZ, the point every mask is sampled at */
    anchor: Node<'vec2'>
    /** painted terrain control map; without one the species covers the whole field */
    control?: ControlMap | null
    maskLow?: UniformNode<'float', number> | null
    maskHigh?: UniformNode<'float', number> | null
    densityMapNode?: TextureNode | null
    channel?: DensityChannel
    /** baked per-instance patch noise, 0-1 */
    densityNoise: Node<'float'>
    /** per-instance white noise, mixed in so patch edges aren't a clean contour */
    random: Node<'float'>
    jitter?: number
}

export function coverageNode(options: CoverageOptions) {
    const { anchor, control, maskLow, maskHigh, densityMapNode, channel = 'r', densityNoise, random, jitter = 0.25 } = options
    let coverage = mix(densityNoise, random, jitter)
    if (control) coverage = coverage.mul(controlMaskNode(control, anchor, maskLow, maskHigh))
    if (densityMapNode) coverage = coverage.mul(channelNode(densityMapNode, channel))
    return coverage
}

/**
 * CPU twin of `coverageNode`, and the bake it enables.
 *
 * The test above only reads static data: baked patch noise, per-instance white
 * noise, and a painted control map. Only the `threshold` it is compared against
 * is live. So evaluate coverage once here, sort the instances by it descending,
 * and the set that passes any threshold is a PREFIX of the instance buffer.
 * `density` then moves `instanceCount` instead of rejecting instances inside the
 * vertex program, which is what a collapse-and-punt costs: every reject still
 * runs the whole thing, control-map fetch and all.
 *
 * The two paths have to agree, so they live side by side in this file. When the
 * CPU cannot reproduce the test the bake declines and the shader keeps it.
 *
 * A field that FOLLOWS the character (`moving`) is the half-way case: its world
 * position changes every frame, so the mask cannot be baked, but the noise term
 * still can. Sorting by noise alone leaves a prefix that is a superset of the
 * passing set — an instance whose noise is already under the threshold can never
 * be rescued by a mask of at most 1 — so the draw count still shrinks and the
 * shader still runs the real test on what survives.
 */

/** matches TSL `.smoothstep(low, high)` */
function smoothstep(low: number, high: number, x: number) {
    if (high === low) return x < low ? 0 : 1
    const t = Math.min(1, Math.max(0, (x - low) / (high - low)))
    return t * t * (3 - 2 * t)
}

/**
 * Below this the mask has collapsed an instance to nothing. grass.ts already punts
 * blades under it out of view, so cutting them from the draw changes no pixels.
 */
export const MASK_EPSILON = 0.01

/**
 * Where a rejected instance is parked. Far above the far plane, so its triangles
 * are clipped whole and never shaded.
 *
 * This is also the DEFAULT position in the scatter vertex programs, not a
 * correction applied at the end: an instance the mask kills returns here without
 * running the height field, the trample fetch or the wind, which is the only cull
 * a following field gets (see the `moving` note above).
 */
export const PUNT_Y = 10000

/** a per-instance array, reordered in step with the anchors */
export interface ScatterAttribute {
    array: Float32Array
    stride: number
}

export interface ScatterBakeInput {
    count: number
    /** world XZ per instance, stride 2 — rewritten in sorted order */
    anchors: Float32Array
    /** every other per-instance array, rewritten in the same order */
    attributes: ScatterAttribute[]
    /**
     * Baked patch noise mixed with per-instance white noise, the flowers and tufts
     * term. Omit it for a mask-only species (grass), where coverage IS the mask.
     */
    noise?: { densityNoises: Float32Array, randoms: Float32Array, jitter?: number } | null
    control?: ControlMap | null
    maskLow: number
    maskHigh: number
    /** an extra mask the bake cannot read; its presence declines the bake */
    densityMap?: Texture | null
    /**
     * The field follows the character (see scatter/focus), so an instance's world
     * position — and with it the control mask — changes every frame. Only the noise
     * term stays static, so only that gets baked and the shader keeps the mask test.
     */
    moving?: boolean
}

export interface ScatterBake {
    /** coverage in buffer order, descending. null = the shader still tests */
    coverage: Float32Array | null
    /**
     * The baked coverage is the WHOLE test, mask included, so the shader can drop
     * it. False on a moving field, where the prefix is only a SUPERSET: the mask is
     * at most 1, so an instance whose noise is under the threshold can never pass
     * and is safe to cut, but one above it can still fail on the mask. The shader
     * has to finish that job.
     */
    masked: boolean
    /** instances to draw at this threshold; the whole grid when not baked */
    countFor: (threshold: number) => number
    /** re-evaluate and re-sort for a new mask band; false when not baked */
    rebake: (maskLow: number, maskHigh: number) => boolean
}

/**
 * How many leading instances have `coverage >= threshold`. Binary search, because
 * the array is sorted descending — the shader used `step(threshold, coverage)`,
 * which passes on equal, so this does too.
 *
 * The threshold is rounded to float32 first. Reading it out of a Float32Array
 * already rounds the coverage, and comparing that against a full-precision JS
 * number loses exact ties: Math.fround(0.9) is a hair BELOW the literal 0.9. The
 * shader compared two float32 values, so this does the same.
 */
export function countAbove(coverage: Float32Array, threshold: number) {
    const edge = Math.fround(threshold)
    let low = 0
    let high = coverage.length
    while (low < high) {
        const mid = (low + high) >>> 1
        if (coverage[mid] >= edge) low = mid + 1
        else high = mid
    }
    return low
}

export function createScatterBake(input: ScatterBakeInput): ScatterBake {
    const { count, anchors, attributes, noise, control, densityMap, moving = false } = input
    // a moving field samples the mask live in the vertex stage, so there is nothing
    // static to read here
    const pixels = control && !moving ? readControlPixels(control) : null
    // a mask this reader cannot reproduce has to stay in the shader
    const masked = !!pixels

    // No mask to bake against, an image that has not decoded, a moving field with
    // no static term of its own (grass, whose coverage IS the mask), or a densityMap
    // whose own uv mapping and flipY this reader does not share: leave it alone.
    if (densityMap || (!pixels && !(moving && noise))) {
        return { coverage: null, masked: false, countFor: () => count, rebake: () => false }
    }

    // keep the unsorted originals: a mask change re-sorts from these, not from
    // the previous ordering
    const srcAnchors = anchors.slice()
    const srcAttributes = attributes.map(a => a.array.slice())

    const coverage = new Float32Array(count)
    const scratch = new Float32Array(count)
    const order = new Uint32Array(count)
    const jitter = noise?.jitter ?? 0.25

    function run(maskLow: number, maskHigh: number) {
        for (let i = 0; i < count; i++) {
            const mask = pixels
                ? smoothstep(maskLow, maskHigh, sampleControlChannel(
                    control!, pixels, srcAnchors[i * 2], srcAnchors[i * 2 + 1], CONTROL_CHANNEL.grass,
                ))
                : 1
            if (noise) {
                // mix(densityNoise, random, jitter)
                const patch = noise.densityNoises[i]
                scratch[i] = (patch + (noise.randoms[i] - patch) * jitter) * mask
            }
            else {
                scratch[i] = mask
            }
            order[i] = i
        }

        order.sort((a, b) => scratch[b] - scratch[a])

        for (let i = 0; i < count; i++) {
            const from = order[i]
            coverage[i] = scratch[from]
            anchors[i * 2] = srcAnchors[from * 2]
            anchors[i * 2 + 1] = srcAnchors[from * 2 + 1]
            for (let a = 0; a < attributes.length; a++) {
                const { array, stride } = attributes[a]
                const src = srcAttributes[a]
                for (let c = 0; c < stride; c++) array[i * stride + c] = src[from * stride + c]
            }
        }
    }

    run(input.maskLow, input.maskHigh)

    return {
        coverage,
        masked,
        countFor: threshold => countAbove(coverage, threshold),
        // without a readable mask the band is not part of the bake, so nothing to redo
        rebake: (maskLow, maskHigh) => {
            if (!pixels) return false
            run(maskLow, maskHigh)
            return true
        },
    }
}
