import type { TresColor } from '@tresjs/core'
import { BufferAttribute, Color, DoubleSide, InstancedBufferAttribute, InstancedBufferGeometry, Matrix4, Sphere, Spherical, Texture, Vector3 } from 'three'
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

// One instanced draw per species: a stem strip plus a procedural head. No textures,
// colors are uniforms so a species is retintable live. Coverage test: see scatter/density.

export type FlowerShape = 'puff' | 'poppy' | 'daisy'

interface FlowerPreset {
    head: 'puff' | 'petals'
    /** puff: cap points, petals: petals around the axis */
    quads: number
    /** puff: quad size, petals: extent outward from the axis */
    petalLength: number
    petalWidth: number
    /** puff: cap radius, petals: axis to petal center */
    radius: number
    /** radians, petals only */
    tilt: number
    liftY: number
    /** 0 = no center disc */
    center: number
    centerY: number
    headSize: number
    height: number
    stemWidth: number
    petalColor: string
    petalColorB: string
    stemColor: string
    centerColor: string
}

export const FLOWER_PRESETS: Record<FlowerShape, FlowerPreset> = {
    // the quads must overlap to read as a ball, fewer or smaller reads as a spiky star.
    // Height 0.85 clears the grass blade tips (0.6)
    puff: {
        head: 'puff', quads: 14, petalLength: 0.55, petalWidth: 0.55, radius: 0.85, tilt: 0,
        liftY: 0.8, center: 0, centerY: 0, headSize: 0.075, height: 0.85, stemWidth: 0.012,
        petalColor: '#ffffff', petalColorB: '#eef1e2', stemColor: '#8fa04a', centerColor: '#ffffff',
    },
    poppy: {
        head: 'petals', quads: 5, petalLength: 0.95, petalWidth: 0.8, radius: 0.42, tilt: 0.8,
        liftY: 0.12, center: 0.32, centerY: 0.24, headSize: 0.12, height: 0.44, stemWidth: 0.012,
        petalColor: '#c4202a', petalColorB: '#dd4433', stemColor: '#7f9440', centerColor: '#2b1a14',
    },
    daisy: {
        head: 'petals', quads: 7, petalLength: 0.85, petalWidth: 0.36, radius: 0.46, tilt: 0.22,
        liftY: 0.06, center: 0.34, centerY: 0.1, headSize: 0.1, height: 0.32, stemWidth: 0.01,
        petalColor: '#e8c22a', petalColorB: '#f4dd5a', stemColor: '#87a04a', centerColor: '#a9760f',
    },
}

export interface FlowersOptions extends WindSettings {
    shape: FlowerShape
    /** instances = subdivisions²; use the same values as Grass */
    subdivisions: number
    size: number
    density?: number
    /** one species per channel */
    densityMap?: Texture | null
    densityMapSize?: number
    densityChannel?: DensityChannel
    control?: ControlMap | null
    /** control.g band the species ramps in across: low = first flowers, high = full */
    maskLow?: number
    maskHigh?: number
    heightField?: HeightField | null
    petalColor?: TresColor
    petalColorB?: TresColor
    stemColor?: TresColor
    centerColor?: TresColor
    height?: number
    headSize?: number
    seed?: string
    trample?: TrampleMap | null
    grading?: GradingContext | null
    /** with a focus the field is a size x size window that follows it (see scatter/focus) */
    focus?: ScatterFocus | null
}

// grass blade strip; the tip is hidden under the head
const STEM_POSITIONS = [
    -1, 0, 0,
    1, 0, 0,
    -0.5, 0.7, 0,
    0.5, 0.7, 0,
    0, 1, 0,
]
const STEM_WIND_WEIGHT = [0, 0, 0.7, 0.7, 1]
const STEM_INDICES = [0, 1, 2, 1, 3, 2, 2, 3, 4]

// the part id drives both the palette pick and the stem/head coordinate space in the shader
const PART_STEM = 0
const PART_PETAL = 1
const PART_CENTER = 2

const ORIGIN = new Vector3()
const UP = new Vector3(0, 1, 0)

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

// WebGPU allows 8 vertex buffers per pipeline, so per-vertex extras are packed into one vec3
// and per-instance extras into one vec4. No normal attribute: the grading finish skips core shadows.
interface TemplateBuilder {
    positions: number[]
    vertexData: number[]
    indices: number[]
}

function createBuilder(): TemplateBuilder {
    return { positions: [], vertexData: [], indices: [] }
}

const QUAD_CORNERS = [-0.5, -0.5, 0, 0.5, -0.5, 0, -0.5, 0.5, 0, 0.5, 0.5, 0]
const QUAD_INDICES = [0, 1, 2, 2, 1, 3]

function addQuad(b: TemplateBuilder, matrix: Matrix4, part: number, ao: number) {
    const base = b.positions.length / 3
    const v = new Vector3()

    for (let i = 0; i < 4; i++) {
        v.set(QUAD_CORNERS[i * 3], QUAD_CORNERS[i * 3 + 1], QUAD_CORNERS[i * 3 + 2]).applyMatrix4(matrix)
        b.positions.push(v.x, v.y, v.z)
        // head quads take full wind weight, they sit at the stem tip
        b.vertexData.push(1, part, ao)
    }
    for (const i of QUAD_INDICES) b.indices.push(base + i)
}

function addStem(b: TemplateBuilder) {
    for (let i = 0; i < 5; i++) {
        b.positions.push(STEM_POSITIONS[i * 3], STEM_POSITIONS[i * 3 + 1], STEM_POSITIONS[i * 3 + 2])
        // openness reuses the wind weight: the stem base sits buried in grass
        b.vertexData.push(STEM_WIND_WEIGHT[i], PART_STEM, STEM_WIND_WEIGHT[i])
    }
    for (const i of STEM_INDICES) b.indices.push(i)
}

function addPuffHead(b: TemplateBuilder, preset: FlowerPreset, rng: () => number) {
    const spherical = new Spherical()
    const dir = new Vector3()
    const pos = new Vector3()
    const scale = new Vector3()
    const matrix = new Matrix4()

    for (let i = 0; i < preset.quads; i++) {
        // cap, not a full sphere: quads below the equator would poke into the stem
        spherical.set(1, Math.PI * 0.62 * rng(), Math.PI * 2 * rng())
        dir.setFromSpherical(spherical)
        // tight radius jitter keeps quads on the shell so they overlap into a ball
        pos.copy(dir).setLength(preset.radius * (1 + (rng() - 0.5) * 0.25))

        matrix.lookAt(dir, ORIGIN, UP)
        matrix.setPosition(pos.x, pos.y + preset.liftY, pos.z)
        const s = preset.petalLength * (1 + (rng() - 0.5) * 0.4)
        matrix.scale(scale.set(s, s, 1))

        addQuad(b, matrix, PART_PETAL, 1)
    }
}

function addPetalHead(b: TemplateBuilder, preset: FlowerPreset, rng: () => number) {
    const matrix = new Matrix4()
    const scale = new Matrix4()
    const flat = new Matrix4().makeRotationX(-Math.PI / 2)
    const out = new Matrix4()
    const tilt = new Matrix4()
    const yaw = new Matrix4()
    const lift = new Matrix4()

    for (let i = 0; i < preset.quads; i++) {
        const angle = (i / preset.quads) * Math.PI * 2 + (rng() - 0.5) * 0.25
        const petalTilt = preset.tilt * (1 + (rng() - 0.5) * 0.3)

        scale.makeScale(preset.petalLength, preset.petalWidth, 1)
        out.makeTranslation(preset.radius, 0, 0)
        tilt.makeRotationZ(petalTilt)
        yaw.makeRotationY(angle)
        lift.makeTranslation(0, preset.liftY, 0)

        matrix.copy(lift).multiply(yaw).multiply(tilt).multiply(out).multiply(flat).multiply(scale)
        addQuad(b, matrix, PART_PETAL, 1)
    }

    if (preset.center > 0) {
        scale.makeScale(preset.center, preset.center, 1)
        lift.makeTranslation(0, preset.centerY, 0)
        matrix.copy(lift).multiply(flat).multiply(scale)
        addQuad(b, matrix, PART_CENTER, 0.85)
    }
}

export function createFlowersGeometry(options: FlowersOptions & { preset: FlowerPreset }) {
    const { subdivisions, size, preset, seed = options.shape } = options
    const rng = mulberry32(hashSeed(seed))

    const builder = createBuilder()
    addStem(builder)
    if (preset.head === 'puff') addPuffHead(builder, preset, rng)
    else addPetalHead(builder, preset, rng)

    const count = subdivisions * subdivisions
    const fragmentSize = size / subdivisions
    const anchors = new Float32Array(count * 2)
    // packed: random, yaw, height noise, color noise (unpacked in buildFlowersMaterial)
    const instanceData = new Float32Array(count * 4)
    const densityNoises = new Float32Array(count)
    // duplicate of instanceData.x, the bake wants it unpacked
    const randoms = new Float32Array(count)
    const noise = new ImprovedNoise()
    // per-species offset so species do not all clump in the same spots
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
            // coarser than grass patchiness so clumps read as beds; the 1.6 gain sharpens bed edges
            densityNoises[i] = Math.min(1, Math.max(0, noise.noise(x * 0.09 + noiseOffset, z * 0.09 + noiseOffset, 0) * 1.6 + 0.5))
        }
    }

    // reorders anchors and instanceData in place
    const bake = createScatterBake({
        count,
        anchors,
        attributes: [{ array: instanceData, stride: 4 }],
        noise: { densityNoises, randoms },
        control: options.control,
        maskLow: options.maskLow ?? 0.25,
        maskHigh: options.maskHigh ?? 0.6,
        densityMap: options.densityMap,
        moving: !!options.focus,
    })

    const geometry = new InstancedBufferGeometry()
    geometry.instanceCount = count
    geometry.setIndex(builder.indices)
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(builder.positions), 3))
    geometry.setAttribute('vertexData', new BufferAttribute(new Float32Array(builder.vertexData), 3))
    const anchorAttribute = new InstancedBufferAttribute(anchors, 2)
    const instanceAttribute = new InstancedBufferAttribute(instanceData, 4)
    geometry.setAttribute('anchor', anchorAttribute)
    geometry.setAttribute('instanceData', instanceAttribute)
    // shader path only; leaving it off keeps a vertex buffer free (WebGPU limit of 8)
    if (!bake.masked) geometry.setAttribute('densityNoise', new InstancedBufferAttribute(densityNoises, 1))
    geometry.boundingSphere = new Sphere(new Vector3(), (size / 2) * Math.SQRT2 + 2)

    const rebake = (maskLow: number, maskHigh: number) => {
        if (!bake.rebake(maskLow, maskHigh)) return false
        anchorAttribute.needsUpdate = true
        instanceAttribute.needsUpdate = true
        return true
    }

    return { geometry, bake, rebake }
}

interface FlowersMaterialOptions {
    petalA: UniformNode<'color', Color>
    petalB: UniformNode<'color', Color>
    stem: UniformNode<'color', Color>
    center: UniformNode<'color', Color>
    height: UniformNode<'float', number>
    headSize: UniformNode<'float', number>
    stemWidth: UniformNode<'float', number>
    threshold: UniformNode<'float', number>
    shadowIntensity: UniformNode<'float', number>
    windUniforms: WindUniforms
    densityMap?: Texture | null
    /** the level's extent, not the field's */
    densityMapSize: number
    densityChannel: DensityChannel
    control?: ControlMap | null
    maskLow?: UniformNode<'float', number> | null
    maskHigh?: UniformNode<'float', number> | null
    heightField?: HeightField | null
    trample?: TrampleMap | null
    grading?: GradingContext | null
    /** coverage is baked on the CPU, so the shader drops the whole test */
    baked?: boolean
    size: number
    focus?: ScatterFocus | null
}

export function buildFlowersMaterial(options: FlowersMaterialOptions) {
    const { petalA, petalB, stem, center, height, headSize, stemWidth, threshold, shadowIntensity, windUniforms, densityMap, densityMapSize, densityChannel, control, maskLow, maskHigh, heightField, trample, grading, baked = false, size, focus } = options
    // Lambert only so the drop-shadow catcher runs
    const material = grading ? new MeshLambertNodeMaterial() : new MeshBasicNodeMaterial()
    material.side = DoubleSide

    const flowerWindOffset = windOffset(windUniforms)
    const anchor = attribute<'vec2'>('anchor', 'vec2')
    // x = wind weight, y = part id, z = openness
    const vertexData = attribute<'vec3'>('vertexData', 'vec3')
    const windWeight = vertexData.x
    const part = vertexData.y
    // x = random, y = yaw, z = height noise, w = color noise
    const instanceData = attribute<'vec4'>('instanceData', 'vec4')
    const worldAnchor = focus ? followAnchor(focus, anchor, size) : anchor
    const densityMapNode = createDensityMapNode(densityMap, worldAnchor, densityMapSize)

    material.positionNode = Fn(() => {
        const random = instanceData.x
        const yaw = instanceData.y

        const worldXZ = worldAnchor.toVar()
        const fade = focus ? followFade(focus, worldXZ, size).toVar() : null

        // The coverage test gates everything below. On a following field the bake only prunes
        // by noise, so mask rejects reach the draw; running height, trample and wind for them
        // was most of the cost of a bed that is mostly road. When baked, instanceCount already cut them.
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

            let stemHeight = height
                .mul(mix(0.75, random, 0.55))
                .mul(instanceData.z)
            if (trampleAmt) stemHeight = stemHeight.mul(trampleAmt.mul(0.85).oneMinus())
            if (fade) stemHeight = stemHeight.mul(fade)
            stemHeight = stemHeight.toVar()

            // stem verts are in blade space, head verts in head-local units above the tip;
            // one attribute switch instead of two draws
            const isHead = step(0.5, part)
            const local = vec3(
                mix(positionGeometry.x.mul(stemWidth), positionGeometry.x.mul(headSize), isHead),
                mix(positionGeometry.y.mul(stemHeight), positionGeometry.y.mul(headSize).add(stemHeight), isHead),
                mix(positionGeometry.z.mul(stemWidth), positionGeometry.z.mul(headSize), isHead),
            ).toVar()
            local.xz.assign(rotateUV(local.xz, yaw, vec2(0)))
            if (fade) local.mulAssign(fade)

            pos.assign(vec3(local.x.add(worldXZ.x), local.y, local.z.add(worldXZ.y)))
            // one height per flower, sampled at the anchor, so a stem on a slope stays straight
            if (heightField) pos.y.addAssign(sampleHeight(heightField, worldXZ))

            let windVec = flowerWindOffset(worldXZ).mul(stemHeight).mul(1.8)
            if (trampleAmt) windVec = windVec.mul(trampleAmt.oneMinus())
            windVec = windVec.toVar()
            pos.addAssign(vec3(windVec.x.mul(windWeight), 0, windVec.y.mul(windWeight)))
            // bend, do not stretch: drop by the arc approximation |w|²/2h
            const droop = windVec.dot(windVec).div(stemHeight.mul(2).max(1e-4)).min(stemHeight.mul(0.35))
            pos.y.subAssign(droop.mul(windWeight).mul(windWeight))

            if (trample) {
                const toFlower = worldXZ.sub(trample.uniforms.interactor)
                const dist = toFlower.length().max(1e-3)
                const push = dist.div(trample.uniforms.interactorRadius).oneMinus().max(0)
                pos.addAssign(vec3(toFlower.x.div(dist), 0, toFlower.y.div(dist)).mul(push.mul(push)).mul(windWeight).mul(0.5))
                pos.y.subAssign(push.mul(push).mul(stemHeight).mul(0.3).mul(windWeight))
            }
        }

        if (live) If(live, body)
        else body()

        return pos
    })()

    // part is constant across a quad, so a varying is enough
    const petal = mix(petalA, petalB, instanceData.w)
    const stemOrPetal = mix(stem, petal, step(0.5, part))
    const base = varying(mix(stemOrPetal, center, step(1.5, part)))

    const openness = vertexData.z

    if (grading) {
        const ao = varying(openness.oneMinus().mul(shadowIntensity).oneMinus())
        const dropShadow = createDropShadowCatcher()
        material.receivedShadowNode = dropShadow.receivedShadowNode
        // no core shadows: petal normals are noisy after the wind bend
        material.outputNode = stylizedOutput(base, grading, { hasCoreShadows: false, aoNode: ao, dropShadowNode: dropShadow.shadowFactor })
    }
    else {
        const ao = varying(openness.oneMinus().mul(shadowIntensity))
        material.colorNode = mix(base, base.mul(0.35), ao)
    }

    // returned so a texture swap can reach it without a rebuild
    return { material, densityMapNode }
}

export function createFlowers(options: FlowersOptions) {
    const preset = FLOWER_PRESETS[options.shape] ?? FLOWER_PRESETS.puff
    const { geometry, bake, rebake } = createFlowersGeometry({ ...options, preset })

    const toColor = (value: TresColor | undefined, fallback: string) =>
        uniform(new Color((value ?? fallback) as ColorRepresentation))

    const petalA = toColor(options.petalColor, preset.petalColor)
    const petalB = toColor(options.petalColorB, preset.petalColorB)
    const stem = toColor(options.stemColor, preset.stemColor)
    const center = toColor(options.centerColor, preset.centerColor)
    const height = uniform(options.height ?? preset.height)
    const headSize = uniform(options.headSize ?? preset.headSize)
    const stemWidth = uniform(preset.stemWidth)
    // density 1 keeps everything, 0 keeps nothing
    const threshold = uniform(1 - (options.density ?? 0.55))
    const shadowIntensity = uniform(0.45)
    const maskLow = uniform(options.maskLow ?? 0.25)
    const maskHigh = uniform(options.maskHigh ?? 0.6)
    const windUniforms = createWindUniforms(options)

    const { material, densityMapNode } = buildFlowersMaterial({
        petalA, petalB, stem, center, height, headSize, stemWidth, threshold, shadowIntensity,
        windUniforms,
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

    const setDensity = (density: number) => {
        const next = 1 - density
        threshold.value = next
        if (bake.coverage) geometry.instanceCount = bake.countFor(next)
    }
    setDensity(options.density ?? 0.55)

    const setMaskBand = (low: number, high: number) => {
        maskLow.value = low
        maskHigh.value = high
        if (rebake(low, high)) setDensity(1 - threshold.value)
    }

    const uniforms = {
        petalColor: petalA,
        petalColorB: petalB,
        stemColor: stem,
        centerColor: center,
        height,
        headSize,
        stemWidth,
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
