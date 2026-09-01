import type { TresColor } from '@tresjs/core'
import { BufferAttribute, Color, DoubleSide, InstancedBufferAttribute, InstancedBufferGeometry, Sphere, Texture, Vector3 } from 'three'
import { attribute, Fn, If, mix, positionGeometry, rotateUV, step, texture, uniform, varying, vec2, vec3 } from 'three/tsl'
import { MeshBasicNodeMaterial, MeshLambertNodeMaterial } from 'three/webgpu'
import { ImprovedNoise } from 'three/examples/jsm/math/ImprovedNoise.js'
import type { ColorRepresentation, UniformNode } from 'three/webgpu'
import { createWindUniforms, windOffset, type WindSettings, type WindUniforms } from '../wind/wind'
import { coverageNode, createDensityMapNode, createScatterBake, MASK_EPSILON, PUNT_Y, type DensityChannel } from '../scatter/density'
import { followAnchor, followFade, type ScatterFocus } from '../scatter/focus'
import { trampleUv, type TrampleMap } from '../../trample/trample'
import type { GradingContext } from '../../grading/grading'
import { createDropShadowCatcher, stylizedOutput } from '../../grading/stylizedOutput'
import { sampleHeight, type HeightField } from '../../terrain/heightField'
import type { ControlMap } from '../../terrain/controlMap'

export interface GrassTuftsOptions extends WindSettings {
    /** keep coarse: a tuft template is ~160 verts, instances = subdivisions² */
    subdivisions?: number
    size: number
    /** read at creation, a change needs a remount */
    blades?: number
    /** read at creation, a change needs a remount */
    segments?: number
    height?: number
    /** scales fan radius and blade width together */
    spread?: number
    density?: number
    densityMap?: Texture | null
    /** world extent the density map spans; the level, not the field */
    densityMapSize?: number
    densityChannel?: DensityChannel
    /** its grass channel (g) is the placement mask */
    control?: ControlMap | null
    maskLow?: number
    maskHigh?: number
    heightField?: HeightField | null
    /** blade base */
    colorA?: TresColor
    /** blade tip */
    colorB?: TresColor
    seed?: string
    trample?: TrampleMap | null
    grading?: GradingContext | null
    /** Turns the field into a `size` x `size` window that follows the focus. See scatter/focus. */
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

// unit space: y in [0, 1] (scaled by height), xz in [-1, 1] (by spread).
// Blades lean outward as t² so the silhouette arcs instead of spiking up.
function buildTuftTemplate(rng: () => number, blades: number, segments: number) {
    const positions: number[] = []
    const bladeT: number[] = []
    const indices: number[] = []

    for (let b = 0; b < blades; b++) {
        const start = positions.length / 3
        const phi = rng() * Math.PI * 2
        const dirX = Math.cos(phi)
        const dirZ = Math.sin(phi)
        // width runs tangentially so the blade stays broad seen from outside the tuft
        const perpX = -dirZ
        const perpZ = dirX

        const baseOffset = 0.05 + rng() * 0.15
        const lean = 0.35 + rng() * 0.6
        const bladeHeight = 0.6 + rng() * 0.4
        // thin blades read as a sparse fan, not a clump
        const width = 0.17 + rng() * 0.1

        for (let i = 0; i <= segments; i++) {
            const t = i / segments
            const out = baseOffset + lean * t * t
            const y = bladeHeight * t * (1 - 0.22 * t)
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
    // random, yaw, heightNoise, colorNoise packed into one vec4: WebGPU caps vertex buffers at 8 per pipeline
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
    // only the shader path reads it; leaving it off keeps a vertex buffer free (WebGPU limit of 8)
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
    densityMapSize: number
    densityChannel: DensityChannel
    control?: ControlMap | null
    maskLow?: UniformNode<'float', number> | null
    maskHigh?: UniformNode<'float', number> | null
    heightField?: HeightField | null
    trample?: TrampleMap | null
    grading?: GradingContext | null
    /** coverage baked on the CPU, so the shader skips the test */
    baked?: boolean
    size: number
    focus?: ScatterFocus | null
}

export function buildGrassTuftsMaterial(options: GrassTuftsMaterialOptions) {
    const { colorA, colorB, height, spread, threshold, shadowIntensity, windUniforms, densityMap, densityMapSize, densityChannel, control, maskLow, maskHigh, heightField, trample, grading, baked = false, size, focus } = options
    // Lambert only so the drop-shadow catcher runs
    const material = grading ? new MeshLambertNodeMaterial() : new MeshBasicNodeMaterial()
    material.side = DoubleSide

    const tuftWindOffset = windOffset(windUniforms)
    const anchor = attribute<'vec2'>('anchor', 'vec2')
    // 0 at base, 1 at tip; drives wind weight, AO and the colour ramp
    const bladeT = attribute<'float'>('bladeT', 'float')
    // x random, y yaw, z height noise, w colour noise (packed in createGrassTuftsGeometry)
    const instanceData = attribute<'vec4'>('instanceData', 'vec4')

    const worldAnchor = focus ? followAnchor(focus, anchor, size) : anchor
    // the mask covers the level, so sample where the tuft stands, not at its lattice anchor
    const densityMapNode = createDensityMapNode(densityMap, worldAnchor, densityMapSize)

    material.positionNode = Fn(() => {
        const random = instanceData.x
        const yaw = instanceData.y

        const worldXZ = worldAnchor.toVar()
        // tufts shrink into the ground at the wrap boundary instead of popping
        const fade = focus ? followFade(focus, worldXZ, size).toVar() : null

        // Early-out: on a following field the bake only prunes by noise, so mask rejects reach the
        // draw and a tuft is ~144 tris (see grass.ts). baked = buffer already sorted and cut, nothing to test.
        const alive = baked
            ? null
            : step(threshold, coverageNode({
                anchor: worldXZ, control, maskLow, maskHigh, densityMapNode, channel: densityChannel, random,
                densityNoise: attribute<'float'>('densityNoise', 'float'),
            })).greaterThan(0.5).toVar()
        const live = fade
            ? (alive ? alive.and(fade.greaterThanEqual(MASK_EPSILON)) : fade.greaterThanEqual(MASK_EPSILON))
            : alive

        const pos = vec3(0, PUNT_Y, 0).toVar()

        const body = () => {
            const trampleAmt = trample ? texture(trample.texture, trampleUv(trample.uniforms, worldXZ)).r.toVar() : null

            let tuftHeight = height
                .mul(mix(0.7, random, 0.5))
                .mul(instanceData.z)
            // stiffer than grass blades, so they flatten less when walked over
            if (trampleAmt) tuftHeight = tuftHeight.mul(trampleAmt.mul(0.55).oneMinus())
            if (fade) tuftHeight = tuftHeight.mul(fade)
            tuftHeight = tuftHeight.toVar()

            const local = vec3(
                positionGeometry.x.mul(spread),
                positionGeometry.y.mul(tuftHeight),
                positionGeometry.z.mul(spread),
            ).toVar()
            local.xz.assign(rotateUV(local.xz, yaw, vec2(0)))
            if (fade) local.mulAssign(fade)

            pos.assign(vec3(local.x.add(worldXZ.x), local.y, local.z.add(worldXZ.y)))
            // one height per tuft, so the fan keeps its shape on a slope
            if (heightField) pos.y.addAssign(sampleHeight(heightField, worldXZ))

            let windVec = tuftWindOffset(worldXZ).mul(tuftHeight).mul(1.4)
            if (trampleAmt) windVec = windVec.mul(trampleAmt.oneMinus())
            windVec = windVec.toVar()
            pos.addAssign(vec3(windVec.x.mul(bladeT), 0, windVec.y.mul(bladeT)))
            // arc approximation |w|²/2h so blades bend instead of stretching
            const droop = windVec.dot(windVec).div(tuftHeight.mul(2).max(1e-4)).min(tuftHeight.mul(0.3))
            pos.y.subAssign(droop.mul(bladeT).mul(bladeT))

            if (trample) {
                const toTuft = worldXZ.sub(trample.uniforms.interactor)
                const dist = toTuft.length().max(1e-3)
                const push = dist.div(trample.uniforms.interactorRadius).oneMinus().max(0)
                pos.addAssign(vec3(toTuft.x.div(dist), 0, toTuft.y.div(dist)).mul(push.mul(push)).mul(bladeT).mul(0.4))
                pos.y.subAssign(push.mul(push).mul(tuftHeight).mul(0.25).mul(bladeT))
            }
        }

        if (live) If(live, body)
        else body()

        return pos
    })()

    // ramp skewed per instance so neighbouring tufts don't share one palette
    const ramp = bladeT.mul(mix(0.7, 1.3, instanceData.w)).clamp(0, 1)
    const base = varying(mix(colorA, colorB, ramp))

    if (grading) {
        const ao = varying(bladeT.oneMinus().mul(shadowIntensity).oneMinus())
        const dropShadow = createDropShadowCatcher()
        material.receivedShadowNode = dropShadow.receivedShadowNode
        // bent-blade normals are noisy, so no core shadows (same as grass)
        material.outputNode = stylizedOutput(base, grading, { hasCoreShadows: false, aoNode: ao, dropShadowNode: dropShadow.shadowFactor })
    }
    else {
        const ao = varying(bladeT.oneMinus().mul(shadowIntensity))
        material.colorNode = mix(base, base.mul(0.35), ao)
    }

    // returned so a texture swap can reach it without a rebuild
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
        baked: bake.masked,
        size: options.size,
        focus: options.focus,
    })

    // baked: density picks the sorted prefix to draw; shader path: it is the vertex test threshold
    const setDensity = (density: number) => {
        const next = 1 - density
        threshold.value = next
        if (bake.coverage) geometry.instanceCount = bake.countFor(next)
    }
    setDensity(options.density ?? 0.35)

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
