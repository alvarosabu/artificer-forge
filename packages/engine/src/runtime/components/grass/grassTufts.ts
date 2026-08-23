import type { TresColor } from '@tresjs/core'
import { BufferAttribute, Color, DoubleSide, InstancedBufferAttribute, InstancedBufferGeometry, Sphere, Texture, Vector3 } from 'three'
import { attribute, float, Fn, mix, positionGeometry, rotateUV, step, texture, uniform, varying, vec2, vec3 } from 'three/tsl'
import { MeshBasicNodeMaterial, MeshLambertNodeMaterial } from 'three/webgpu'
import { ImprovedNoise } from 'three/examples/jsm/math/ImprovedNoise.js'
import type { ColorRepresentation, UniformNode } from 'three/webgpu'
import { createWindUniforms, windOffset, type WindSettings, type WindUniforms } from '../wind/wind'
import { coverageNode, createDensityMapNode, createScatterBake, type DensityChannel } from '../scatter/density'
import { followAnchor, followFade, type ScatterFocus } from '../scatter/focus'
import { trampleUv, type TrampleMap } from '../../trample/trample'
import type { GradingContext } from '../../grading/grading'
import { createDropShadowCatcher, stylizedOutput } from '../../grading/stylizedOutput'
import { sampleHeight, type HeightField } from '../../terrain/heightField'
import type { ControlMap } from '../../terrain/controlMap'

/**
 * Tall sword-leaf clumps scattered as sparse spots over the grass field.
 *
 * One instance = one tuft: blades radiating from a shared base, each a
 * multi-segment strip following a static arc (the field grass's 5-vert blade is
 * straight and only bends under wind — the arc is what makes these read as tall
 * leaves rather than long lawn).
 *
 * Placement reuses the flowers coverage test — terrain control map × patch noise,
 * with the baked height field standing each tuft on the ground — baked and sorted
 * on the CPU so `density` only moves `instanceCount`. The grid still wants to stay
 * coarse: a tuft template is ~160 verts against a flower's ~60, so every DRAWN
 * instance is expensive even though rejects are now free.
 */

export interface GrassTuftsOptions extends WindSettings {
    /** scatter grid per side — keep coarse, instances = subdivisions² */
    subdivisions?: number
    size: number
    /** blades per tuft, read at creation (change needs a remount) */
    blades?: number
    /** segments per blade, read at creation — more = smoother arc */
    segments?: number
    /** tallest blade, world units */
    height?: number
    /** fan radius AND blade width scale — a wider tuft has broader leaves */
    spread?: number
    density?: number
    densityMap?: Texture | null
    /** world extent the density map spans, defaulting to `size` */
    densityMapSize?: number
    densityChannel?: DensityChannel
    /** terrain control map; its grass channel is the primary placement mask */
    control?: ControlMap | null
    /** control.g band the tufts ramp in across: low = first tufts, high = full */
    maskLow?: number
    maskHigh?: number
    /** baked terrain heights; without one the field stays flat at y = 0 */
    heightField?: HeightField | null
    /** blade base color (darker, shaded interior) */
    colorA?: TresColor
    /** blade tip color */
    colorB?: TresColor
    seed?: string
    trample?: TrampleMap | null
    grading?: GradingContext | null
    /**
     * With a focus the field becomes a `size` x `size` window that rides along with
     * it, instead of a patch pinned to the origin. See scatter/focus.
     */
    focus?: ScatterFocus | null
}

function hashSeed(str: string): number {
    let h = 0
    for (let i = 0; i < str.length; i++)
        h = Math.imul(31, h) + str.charCodeAt(i) | 0
    return h
}

function mulberry32(seed: number): () => number {
    return function () {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
        return ((t ^ t >>> 14) >>> 0) / 4294967296
    }
}

/**
 * Blades in unit space: y ∈ [0, 1] scaled by `height`, xz ∈ [-1, 1] by `spread`.
 * Each blade leans outward as t² and flattens near the tip, so the silhouette
 * arcs instead of spiking straight up.
 */
function buildTuftTemplate(rng: () => number, blades: number, segments: number) {
    const positions: number[] = []
    // one channel does double duty: wind weight AND openness both ramp with height
    const bladeT: number[] = []
    const indices: number[] = []

    for (let b = 0; b < blades; b++) {
        const start = positions.length / 3
        const phi = rng() * Math.PI * 2
        const dirX = Math.cos(phi)
        const dirZ = Math.sin(phi)
        // perpendicular in the horizontal plane: blade faces outward, so its
        // width spans tangentially and it stays broad seen from outside the tuft
        const perpX = -dirZ
        const perpZ = dirX

        const baseOffset = 0.05 + rng() * 0.15
        const lean = 0.35 + rng() * 0.6
        const bladeHeight = 0.6 + rng() * 0.4
        // broad sword leaves: thin blades read as a sparse fan, not a clump
        const width = 0.17 + rng() * 0.1

        for (let i = 0; i <= segments; i++) {
            const t = i / segments
            const out = baseOffset + lean * t * t
            const y = bladeHeight * t * (1 - 0.22 * t)
            // taper toward a near-point tip, but stay broad through the midsection
            const halfWidth = width * 0.5 * (1 - t * 0.7)

            positions.push(
                dirX * out - perpX * halfWidth, y, dirZ * out - perpZ * halfWidth,
                dirX * out + perpX * halfWidth, y, dirZ * out + perpZ * halfWidth,
            )
            bladeT.push(t, t)
        }

        for (let i = 0; i < segments; i++) {
            const v = start + i * 2
            indices.push(v, v + 1, v + 2, v + 2, v + 1, v + 3)
        }
    }

    return { positions, bladeT, indices }
}

export function createGrassTuftsGeometry(options: GrassTuftsOptions) {
    const { size, subdivisions = 20, blades = 18, segments = 4, seed = 'tufts' } = options
    const rng = mulberry32(hashSeed(seed))
    const template = buildTuftTemplate(rng, blades, segments)

    const count = subdivisions * subdivisions
    const fragmentSize = size / subdivisions
    const anchors = new Float32Array(count * 2)
    // random, yaw, heightNoise, colorNoise packed into one vec4 (WebGPU caps
    // vertex buffers at 8 per pipeline)
    const instanceData = new Float32Array(count * 4)
    const densityNoises = new Float32Array(count)
    // the bake needs the white noise unpacked; the shader still reads instanceData.x
    const randoms = new Float32Array(count)
    const noise = new ImprovedNoise()
    const noiseOffset = hashSeed(seed) % 97

    for (let iX = 0; iX < subdivisions; iX++) {
        for (let iZ = 0; iZ < subdivisions; iZ++) {
            const i = iX * subdivisions + iZ
            const x = (iX + 0.5) / subdivisions * size - size / 2 + (rng() - 0.5) * fragmentSize
            const z = (iZ + 0.5) / subdivisions * size - size / 2 + (rng() - 0.5) * fragmentSize

            anchors[i * 2] = x
            anchors[i * 2 + 1] = z
            instanceData[i * 4] = randoms[i] = rng()
            instanceData[i * 4 + 1] = rng() * Math.PI * 2
            instanceData[i * 4 + 2] = noise.noise(x * 0.0321, z * 0.0321, 0) * 0.5 + 1
            instanceData[i * 4 + 3] = noise.noise(x * 0.02, z * 0.02, 0) * 0.5 + 0.5
            // finer than the flower beds: tufts want scattered spots, not fields
            densityNoises[i] = Math.min(1, Math.max(0, noise.noise(x * 0.16 + noiseOffset, z * 0.16 + noiseOffset, 0) * 1.4 + 0.5))
        }
    }

    // sorts anchors and instanceData by coverage in place when it can
    const bake = createScatterBake({
        count,
        anchors,
        attributes: [{ array: instanceData, stride: 4 }],
        noise: { densityNoises, randoms },
        control: options.control,
        maskLow: options.maskLow ?? 0.25,
        maskHigh: options.maskHigh ?? 0.6,
        densityMap: options.densityMap,
        // a following field can only bake the noise term; the mask stays in the shader
        moving: !!options.focus,
    })

    const geometry = new InstancedBufferGeometry()
    geometry.instanceCount = count
    geometry.setIndex(template.indices)
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(template.positions), 3))
    geometry.setAttribute('bladeT', new BufferAttribute(new Float32Array(template.bladeT), 1))
    const anchorAttribute = new InstancedBufferAttribute(anchors, 2)
    const instanceAttribute = new InstancedBufferAttribute(instanceData, 4)
    geometry.setAttribute('anchor', anchorAttribute)
    geometry.setAttribute('instanceData', instanceAttribute)
    // only the shader path reads this, and leaving it off keeps a vertex buffer
    // free against the WebGPU limit of 8
    if (!bake.masked) geometry.setAttribute('densityNoise', new InstancedBufferAttribute(densityNoises, 1))
    geometry.boundingSphere = new Sphere(new Vector3(), (size / 2) * Math.SQRT2 + (options.height ?? 2.2) + 2)

    const rebake = (maskLow: number, maskHigh: number) => {
        if (!bake.rebake(maskLow, maskHigh)) return false
        anchorAttribute.needsUpdate = true
        instanceAttribute.needsUpdate = true
        return true
    }

    return { geometry, bake, rebake }
}

interface GrassTuftsMaterialOptions {
    colorA: UniformNode<'color', Color>
    colorB: UniformNode<'color', Color>
    height: UniformNode<'float', number>
    spread: UniformNode<'float', number>
    threshold: UniformNode<'float', number>
    shadowIntensity: UniformNode<'float', number>
    windUniforms: WindUniforms
    densityMap?: Texture | null
    /** world extent the density map spans; the LEVEL, not the field */
    densityMapSize: number
    densityChannel: DensityChannel
    control?: ControlMap | null
    maskLow?: UniformNode<'float', number> | null
    maskHigh?: UniformNode<'float', number> | null
    heightField?: HeightField | null
    trample?: TrampleMap | null
    grading?: GradingContext | null
    /** coverage already baked on the CPU: drop the whole test from the shader */
    baked?: boolean
    size: number
    focus?: ScatterFocus | null
}

export function buildGrassTuftsMaterial(options: GrassTuftsMaterialOptions) {
    const { colorA, colorB, height, spread, threshold, shadowIntensity, windUniforms, densityMap, densityMapSize, densityChannel, control, maskLow, maskHigh, heightField, trample, grading, baked = false, size, focus } = options
    // graded tufts catch drop shadows — Lambert base only so the catcher runs
    const material = grading ? new MeshLambertNodeMaterial() : new MeshBasicNodeMaterial()
    material.side = DoubleSide

    const tuftWindOffset = windOffset(windUniforms)
    const anchor = attribute<'vec2'>('anchor', 'vec2')
    // 0 at the blade base, 1 at the tip: wind weight, openness and color ramp
    const bladeT = attribute<'float'>('bladeT', 'float')
    // packed per-instance: x = random, y = yaw, z = height noise, w = color noise
    const instanceData = attribute<'vec4'>('instanceData', 'vec4')

    // with a focus the lattice anchor is folded into the window around it
    const worldAnchor = focus ? followAnchor(focus, anchor, size) : anchor
    // a painted mask covers the level, so it is read at the position the tuft
    // stands on rather than at its lattice anchor
    const densityMapNode = createDensityMapNode(densityMap, worldAnchor, densityMapSize)

    material.positionNode = Fn(() => {
        const random = instanceData.x
        const yaw = instanceData.y

        const worldXZ = worldAnchor.toVar()
        // tufts shrink into the ground towards the wrap boundary instead of popping
        // in and out on it
        const fade = focus ? followFade(focus, worldXZ, size).toVar() : null

        const trampleAmt = trample ? texture(trample.texture, trampleUv(trample.uniforms, worldXZ)).r.toVar() : null

        let tuftHeight = height
            .mul(mix(0.7, random, 0.5))
            .mul(instanceData.z)
        // tufts are stiffer than blades: they flatten less when walked over
        if (trampleAmt) tuftHeight = tuftHeight.mul(trampleAmt.mul(0.55).oneMinus())
        if (fade) tuftHeight = tuftHeight.mul(fade)
        tuftHeight = tuftHeight.toVar()

        const local = vec3(
            positionGeometry.x.mul(spread),
            positionGeometry.y.mul(tuftHeight),
            positionGeometry.z.mul(spread),
        ).toVar()
        local.xz.assign(rotateUV(local.xz, yaw, vec2(0)))

        // baked: the buffer is sorted by coverage and instanceCount already cuts
        // the rejects, so there is nothing to test here
        const visible = baked
            ? null
            : step(threshold, coverageNode({
                anchor: worldXZ, control, maskLow, maskHigh, densityMapNode, channel: densityChannel, random,
                densityNoise: attribute<'float'>('densityNoise', 'float'),
            })).toVar()
        // failing instances collapse to zero area at the anchor
        if (visible) local.mulAssign(visible)
        if (fade) local.mulAssign(fade)

        const pos = vec3(local.x.add(worldXZ.x), local.y, local.z.add(worldXZ.y)).toVar()
        // sampled at the anchor, not per vertex: the whole tuft stands on one
        // terrain height, so its blades keep their fan shape on a slope
        if (heightField) pos.y.addAssign(sampleHeight(heightField, worldXZ))

        // wind, same curve as grass: sway scales with height, weight bends the blade
        let windVec = tuftWindOffset(worldXZ).mul(tuftHeight).mul(1.4)
        if (trampleAmt) windVec = windVec.mul(trampleAmt.oneMinus())
        windVec = windVec.toVar()
        pos.addAssign(vec3(windVec.x.mul(bladeT), 0, windVec.y.mul(bladeT)))
        // bend, don't stretch: drop by the arc approximation |w|²/2h
        const droop = windVec.dot(windVec).div(tuftHeight.mul(2).max(1e-4)).min(tuftHeight.mul(0.3))
        pos.y.subAssign(droop.mul(bladeT).mul(bladeT))

        // live interactor: blades part away from whoever stands in the tuft
        if (trample) {
            const toTuft = worldXZ.sub(trample.uniforms.interactor)
            const dist = toTuft.length().max(1e-3)
            const push = dist.div(trample.uniforms.interactorRadius).oneMinus().max(0)
            pos.addAssign(vec3(toTuft.x.div(dist), 0, toTuft.y.div(dist)).mul(push.mul(push)).mul(bladeT).mul(0.4))
            pos.y.subAssign(push.mul(push).mul(tuftHeight).mul(0.25).mul(bladeT))
        }

        // zero area alone is not enough now that the ground is not at y = 0: a
        // collapsed instance would still leave slivers on the terrain surface
        if (visible) pos.y.addAssign(visible.lessThan(0.5).select(float(1000), float(0)))
        if (fade) pos.y.addAssign(fade.lessThan(0.01).select(float(1000), float(0)))

        return pos
    })()

    // vertical gradient dark base → light tip, with the ramp skewed per instance
    // so neighbouring tufts don't share one palette
    const ramp = bladeT.mul(mix(0.7, 1.3, instanceData.w)).clamp(0, 1)
    const base = varying(mix(colorA, colorB, ramp))

    if (grading) {
        const ao = varying(bladeT.oneMinus().mul(shadowIntensity).oneMinus())
        const dropShadow = createDropShadowCatcher()
        material.receivedShadowNode = dropShadow.receivedShadowNode
        // blade normals after the arc + wind bend are noisy — no core shadows, same as grass
        material.outputNode = stylizedOutput(base, grading, { hasCoreShadows: false, aoNode: ao, dropShadowNode: dropShadow.shadowFactor })
    }
    else {
        const ao = varying(bladeT.oneMinus().mul(shadowIntensity))
        material.colorNode = mix(base, base.mul(0.35), ao)
    }

    // the node comes back out so a texture swap can reach it without a rebuild
    return { material, densityMapNode }
}

export function createGrassTufts(options: GrassTuftsOptions) {
    const { geometry, bake, rebake } = createGrassTuftsGeometry(options)

    const colorA = uniform(new Color((options.colorA ?? '#2f5d2a') as ColorRepresentation))
    const colorB = uniform(new Color((options.colorB ?? '#7fae3c') as ColorRepresentation))
    const height = uniform(options.height ?? 2.2)
    const spread = uniform(options.spread ?? 0.45)
    // density 1 keeps every tuft, 0 keeps none
    const threshold = uniform(1 - (options.density ?? 0.35))
    const shadowIntensity = uniform(0.55)
    const maskLow = uniform(options.maskLow ?? 0.25)
    const maskHigh = uniform(options.maskHigh ?? 0.6)
    const windUniforms = createWindUniforms(options)
    const { material, densityMapNode } = buildGrassTuftsMaterial({
        colorA, colorB, height, spread, threshold, shadowIntensity, windUniforms,
        densityMap: options.densityMap,
        densityMapSize: options.densityMapSize ?? options.size,
        densityChannel: options.densityChannel ?? 'r',
        control: options.control,
        maskLow,
        maskHigh,
        heightField: options.heightField,
        trample: options.trample,
        grading: options.grading,
        // only a bake that includes the mask can retire the shader test
        baked: bake.masked,
        size: options.size,
        focus: options.focus,
    })

    // baked: density picks how much of the coverage-sorted prefix to draw.
    // shader path: it stays the threshold the vertex test compares against.
    const setDensity = (density: number) => {
        const next = 1 - density
        threshold.value = next
        if (bake.coverage) geometry.instanceCount = bake.countFor(next)
    }
    setDensity(options.density ?? 0.35)

    // the band feeds the baked coverage, so moving it has to re-sort and re-upload
    const setMaskBand = (low: number, high: number) => {
        maskLow.value = low
        maskHigh.value = high
        if (rebake(low, high)) setDensity(1 - threshold.value)
    }

    const uniforms = {
        colorA,
        colorB,
        height,
        spread,
        threshold,
        shadowIntensity,
        maskLow,
        maskHigh,
        densityMap: densityMapNode,
        wind: windUniforms,
        grading: options.grading,
    }

    return { geometry, material, uniforms, setDensity, setMaskBand, dispose: () => {
        geometry.dispose()
        material.dispose()
    } }
}
