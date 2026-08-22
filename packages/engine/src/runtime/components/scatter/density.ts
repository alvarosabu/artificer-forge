import { attribute, mix, texture } from 'three/tsl'
import type { Node, TextureNode, UniformNode } from 'three/webgpu'
import type { Texture } from 'three'
import { controlUv, type ControlMap } from '../../terrain/controlMap'

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
 * Callers multiply their local vertex position by `step(threshold, coverage)` so
 * rejected instances collapse to zero area — no rebuild when the mask or density
 * changes, at the cost of a wasted vertex invocation per rejected instance.
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
