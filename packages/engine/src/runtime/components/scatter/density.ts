import { mix, texture } from 'three/tsl'
import type { Node, TextureNode, UniformNode } from 'three/webgpu'
import type { Texture } from 'three'
import { CONTROL_CHANNEL, controlUv, readControlPixels, sampleControlChannel, type ControlMap } from '../../terrain/controlMap'

// Coverage test shared by flowers and grass tufts. The control map is the same
// mask the ground material blends grass with, so vegetation stops at the road for free.

export type DensityChannel = 'r' | 'g' | 'b' | 'a'

export function channelNode(node: TextureNode, channel: DensityChannel) {
    if (channel === 'g') return node.g
    if (channel === 'b') return node.b
    if (channel === 'a') return node.a
    return node.r
}

// Sample at the instance's world position, not its grid anchor: on a following field
// those differ (see scatter/focus). `size` is the map's level extent, not the field's.
export function createDensityMapNode(map: Texture | null | undefined, worldXZ: Node<'vec2'>, size: number) {
    if (!map) return null
    return texture(map, worldXZ.div(size).add(0.5))
}

// Must match the grass channel test in grass.ts so blades and flowers agree on where grass ends.
export function controlMaskNode(
    control: ControlMap,
    worldXZ: Node<'vec2'>,
    low?: UniformNode<'float', number> | null,
    high?: UniformNode<'float', number> | null,
) {
    return texture(control.texture, controlUv(control.uniforms, worldXZ)).g.smoothstep(low, high)
}

export interface CoverageOptions {
    anchor: Node<'vec2'>
    control?: ControlMap | null
    maskLow?: UniformNode<'float', number> | null
    maskHigh?: UniformNode<'float', number> | null
    densityMapNode?: TextureNode | null
    channel?: DensityChannel
    densityNoise: Node<'float'>
    /** mixed in by `jitter` so patch edges are not a clean contour */
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

// CPU twin of `coverageNode`: the two must agree. Coverage is sorted descending so the
// passing set for any threshold is a prefix of the instance buffer.

/** matches TSL `.smoothstep(low, high)` */
function smoothstep(low: number, high: number, x: number) {
    if (high === low) return x < low ? 0 : 1
    const t = Math.min(1, Math.max(0, (x - low) / (high - low)))
    return t * t * (3 - 2 * t)
}

// grass.ts already punts blades under this out of view, so cutting them changes no pixels
export const MASK_EPSILON = 0.01

// Rejected instances park here, past the far plane so they clip whole. It is the DEFAULT
// position in the scatter vertex programs, so a killed instance skips height, trample and wind.
export const PUNT_Y = 10000

export interface ScatterAttribute {
    array: Float32Array
    stride: number
}

export interface ScatterBakeInput {
    count: number
    /** stride 2; rewritten in place in sorted order, as are `attributes` */
    anchors: Float32Array
    attributes: ScatterAttribute[]
    /** omit for a mask-only species (grass), where coverage is the mask alone */
    noise?: { densityNoises: Float32Array, randoms: Float32Array, jitter?: number } | null
    control?: ControlMap | null
    maskLow: number
    maskHigh: number
    /** the bake cannot read this; its presence declines the bake */
    densityMap?: Texture | null
    /** the field follows the character (see scatter/focus): only the noise term is static, so only that is baked */
    moving?: boolean
}

export interface ScatterBake {
    /** descending, in buffer order. null = the shader still tests */
    coverage: Float32Array | null
    /**
     * True when the bake is the WHOLE test and the shader can drop it. False on a moving
     * field: the prefix is only a superset (a mask <= 1 cannot rescue noise under the threshold), so the shader still tests the mask.
     */
    masked: boolean
    countFor: (threshold: number) => number
    rebake: (maskLow: number, maskHigh: number) => boolean
}

// `>=` matches the shader's step(threshold, coverage), which passes on equal. The threshold
// is rounded to float32 first or exact ties are lost: Math.fround(0.9) is a hair below 0.9.
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
    // a moving field samples the mask live, so there is nothing static to read
    const pixels = control && !moving ? readControlPixels(control) : null
    const masked = !!pixels

    // decline when there is nothing static to bake, or when a densityMap is present:
    // its uv mapping and flipY are not reproduced here
    if (densityMap || (!pixels && !(moving && noise))) {
        return { coverage: null, masked: false, countFor: () => count, rebake: () => false }
    }

    // a rebake re-sorts from the unsorted originals, not from the previous order
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
                // must match coverageNode: mix(densityNoise, random, jitter)
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
        rebake: (maskLow, maskHigh) => {
            if (!pixels) return false
            run(maskLow, maskHigh)
            return true
        },
    }
}
