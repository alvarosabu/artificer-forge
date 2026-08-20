import { attribute, mix, texture } from 'three/tsl'
import type { Node, TextureNode } from 'three/webgpu'
import type { Texture } from 'three'

/**
 * Shared coverage test for scattered vegetation (flowers, grass tufts).
 *
 * Where a species grows = painted mask × baked patch noise, evaluated in the
 * vertex stage. Callers multiply their local vertex position by `step(threshold,
 * coverage)` so rejected instances collapse to zero area — no rebuild when the
 * mask or density changes, at the cost of a wasted vertex invocation per
 * rejected instance.
 */

/** one species per channel, the way a terrain weightmap packs layers */
export type DensityChannel = 'r' | 'g' | 'b' | 'a'

export function channelNode(node: TextureNode, channel: DensityChannel) {
    if (channel === 'g') return node.g
    if (channel === 'b') return node.b
    if (channel === 'a') return node.a
    return node.r
}

/** anchor ∈ [-size/2, size/2] → field UV [0, 1], same mapping as the grass splat */
export function createDensityMapNode(map: Texture | null | undefined, size: number) {
    if (!map) return null
    return texture(map, attribute<'vec2'>('anchor', 'vec2').div(size).add(0.5))
}

export interface CoverageOptions {
    densityMapNode?: TextureNode | null
    channel?: DensityChannel
    /** baked per-instance patch noise, 0-1 */
    densityNoise: Node<'float'>
    /** per-instance white noise, mixed in so patch edges aren't a clean contour */
    random: Node<'float'>
    jitter?: number
}

export function coverageNode(options: CoverageOptions) {
    const { densityMapNode, channel = 'r', densityNoise, random, jitter = 0.25 } = options
    const patch = mix(densityNoise, random, jitter)
    return densityMapNode ? channelNode(densityMapNode, channel).mul(patch) : patch
}
