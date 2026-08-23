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

/**
 * Scattered flowers over the same field as Grass: one instanced draw per species.
 *
 * A flower is a thin stem strip (the grass blade shape) with a procedural head
 * merged on top. Head shape comes from a preset — `puff` scatters tiny quads over
 * a spherical cap (dandelion), `petals` splays quads radially into a cup (poppy,
 * daisy). No textures: colors are uniforms, so a species is retintable live.
 *
 * Where flowers grow is a density test: the terrain control map's grass channel
 * times baked Perlin patchiness (see scatter/density). They sit on the terrain by
 * sampling the baked height field at the anchor, so a whole flower rides one
 * height instead of shearing across a slope.
 *
 * That test is baked and sorted on the CPU, so the instance buffer runs from most
 * to least covered and `density` only moves `instanceCount`. A rejected flower
 * costs nothing. Without a readable control map the test falls back into the
 * vertex stage, where rejects collapse to zero area and get punted out of view.
 */

export type FlowerShape = 'puff' | 'poppy' | 'daisy'

interface FlowerPreset {
    head: 'puff' | 'petals'
    /** quads in the head (puff: cap points, petals: petals around the axis) */
    quads: number
    /** petal extent outward from the axis / puff quad size, in head-local units */
    petalLength: number
    petalWidth: number
    /** distance from the axis to the petal center (petals) or cap radius (puff) */
    radius: number
    /** petal lift from horizontal, radians (petals only) */
    tilt: number
    /** head-local Y of the petal ring / puff cap center */
    liftY: number
    /** center disc size in head-local units, 0 = no center */
    center: number
    centerY: number
    /** head-local → world scale */
    headSize: number
    height: number
    stemWidth: number
    petalColor: string
    petalColorB: string
    stemColor: string
    centerColor: string
}

export const FLOWER_PRESETS: Record<FlowerShape, FlowerPreset> = {
    // Bruno's dandelion trick: quads scattered over a cap read as fluff. They must
    // overlap to look like a ball — too few or too small and it reads as a spiky star.
    // Stands taller than the grass (0.6) so the heads clear the blade tips
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
    /** scatter grid per side — instances = subdivisions², share Grass's field values */
    subdivisions: number
    size: number
    /** 0-1 coverage: 1 keeps every instance, lower carves the field into patches */
    density?: number
    /** extra coverage mask sampled at the anchor, one species per channel */
    densityMap?: Texture | null
    /** world extent the density map spans, defaulting to `size` */
    densityMapSize?: number
    densityChannel?: DensityChannel
    /** terrain control map; its grass channel is the primary placement mask */
    control?: ControlMap | null
    /** control.g band the species ramps in across: low = first flowers, high = full */
    maskLow?: number
    maskHigh?: number
    /** baked terrain heights; without one the field stays flat at y = 0 */
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
    /**
     * With a focus the field becomes a `size` x `size` window that rides along with
     * it, instead of a bed pinned to the origin. See scatter/focus.
     */
    focus?: ScatterFocus | null
}

// stem: the grass blade strip — 2 base verts, 2 at mid width, 1 tip (hidden under the head).
// x spans ±1 (scaled by stemWidth), y spans 0-1 (scaled by height)
const STEM_POSITIONS = [
    -1, 0, 0,
    1, 0, 0,
    -0.5, 0.7, 0,
    0.5, 0.7, 0,
    0, 1, 0,
]
const STEM_WIND_WEIGHT = [0, 0, 0.7, 0.7, 1]
const STEM_INDICES = [0, 1, 2, 1, 3, 2, 2, 3, 4]

// part id: 0 = stem, 1 = petal, 2 = center. Drives both the color pick and the
// head/stem coordinate space (stem verts scale by stemWidth × height, head verts
// by headSize then translate to the stem top)
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

// WebGPU allows 8 vertex buffers per pipeline, so per-vertex extras ride in one
// vec3 (windWeight, part, ao) and per-instance extras in one vec4 + one float.
// No normal attribute: the grading finish skips core shadows (same as grass)
interface TemplateBuilder {
    positions: number[]
    vertexData: number[]
    indices: number[]
}

function createBuilder(): TemplateBuilder {
    return { positions: [], vertexData: [], indices: [] }
}

// unit quad in the XY plane, normal +Z, CCW from the front
const QUAD_CORNERS = [-0.5, -0.5, 0, 0.5, -0.5, 0, -0.5, 0.5, 0, 0.5, 0.5, 0]
const QUAD_INDICES = [0, 1, 2, 2, 1, 3]

function addQuad(b: TemplateBuilder, matrix: Matrix4, part: number, ao: number) {
    const base = b.positions.length / 3
    const v = new Vector3()

    for (let i = 0; i < 4; i++) {
        v.set(QUAD_CORNERS[i * 3], QUAD_CORNERS[i * 3 + 1], QUAD_CORNERS[i * 3 + 2]).applyMatrix4(matrix)
        b.positions.push(v.x, v.y, v.z)
        // the whole head rides the wind at full weight — it sits at the stem tip
        b.vertexData.push(1, part, ao)
    }
    for (const i of QUAD_INDICES) b.indices.push(base + i)
}

function addStem(b: TemplateBuilder) {
    for (let i = 0; i < 5; i++) {
        b.positions.push(STEM_POSITIONS[i * 3], STEM_POSITIONS[i * 3 + 1], STEM_POSITIONS[i * 3 + 2])
        // openness follows height: the stem base sits buried in grass
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
        // cap, not full sphere: quads below the equator would poke into the stem
        spherical.set(1, Math.PI * 0.62 * rng(), Math.PI * 2 * rng())
        dir.setFromSpherical(spherical)
        // tight radius jitter keeps quads on the shell so they overlap into a ball
        pos.copy(dir).setLength(preset.radius * (1 + (rng() - 0.5) * 0.25))

        // face outward from the cap center, like Bruno's flowers
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

        // flat: quad normal → +Y, length along X, width along Z
        // out: push outward so the inner edge meets the axis
        // tilt: rotate about Z, lifting the outer edge into a cup
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
    // random, yaw, heightNoise, colorNoise packed into one vec4
    const instanceData = new Float32Array(count * 4)
    // patch noise decides where the species grows, baked once at the anchor
    const densityNoises = new Float32Array(count)
    // the bake needs the white noise unpacked; the shader still reads instanceData.x
    const randoms = new Float32Array(count)
    const noise = new ImprovedNoise()
    // offset the noise field per species so they don't all clump in the same spots
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
            // coarser than grass patchiness so clumps read as flower beds; the 1.6
            // gain pushes most of the field to fully-in or fully-out, sharpening bed edges
            densityNoises[i] = Math.min(1, Math.max(0, noise.noise(x * 0.09 + noiseOffset, z * 0.09 + noiseOffset, 0) * 1.6 + 0.5))
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
    geometry.setIndex(builder.indices)
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(builder.positions), 3))
    geometry.setAttribute('vertexData', new BufferAttribute(new Float32Array(builder.vertexData), 3))
    const anchorAttribute = new InstancedBufferAttribute(anchors, 2)
    const instanceAttribute = new InstancedBufferAttribute(instanceData, 4)
    geometry.setAttribute('anchor', anchorAttribute)
    geometry.setAttribute('instanceData', instanceAttribute)
    // only the shader path reads this, and leaving it off keeps a vertex buffer
    // free against the WebGPU limit of 8
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

export function buildFlowersMaterial(options: FlowersMaterialOptions) {
    const { petalA, petalB, stem, center, height, headSize, stemWidth, threshold, shadowIntensity, windUniforms, densityMap, densityMapSize, densityChannel, control, maskLow, maskHigh, heightField, trample, grading, baked = false, size, focus } = options
    // graded flowers catch drop shadows — Lambert base only so the catcher runs
    const material = grading ? new MeshLambertNodeMaterial() : new MeshBasicNodeMaterial()
    material.side = DoubleSide

    const flowerWindOffset = windOffset(windUniforms)
    const anchor = attribute<'vec2'>('anchor', 'vec2')
    // packed per-vertex: x = wind weight, y = part id, z = openness
    const vertexData = attribute<'vec3'>('vertexData', 'vec3')
    const windWeight = vertexData.x
    const part = vertexData.y
    // packed per-instance: x = random, y = yaw, z = height noise, w = color noise
    const instanceData = attribute<'vec4'>('instanceData', 'vec4')
    // with a focus the lattice anchor is folded into the window around it
    const worldAnchor = focus ? followAnchor(focus, anchor, size) : anchor
    // a painted mask covers the level, so it is read at the position the flower
    // stands on rather than at its lattice anchor
    const densityMapNode = createDensityMapNode(densityMap, worldAnchor, densityMapSize)

    material.positionNode = Fn(() => {
        const random = instanceData.x
        const yaw = instanceData.y

        const worldXZ = worldAnchor.toVar()
        // flowers shrink into the ground towards the wrap boundary instead of
        // popping in and out on it
        const fade = focus ? followFade(focus, worldXZ, size).toVar() : null

        // The coverage test comes FIRST and everything else hangs off it. On a
        // following field the CPU bake can only prune by the noise term (see
        // scatter/density), so the mask rejects survive into the draw — and a
        // rejected flower here is ~30 triangles of stem and petals. Running the
        // height field, the trample fetch and the wind for it was most of the cost
        // of a bed that is mostly road.
        //
        // baked: the buffer is sorted by the WHOLE test and instanceCount already
        // cut the rejects, so there is nothing left to test.
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

            // stem verts live in ±1 × 0-1 blade space, head verts in head-local units
            // above the stem tip — one attribute switch instead of two draws
            const isHead = step(0.5, part)
            const local = vec3(
                mix(positionGeometry.x.mul(stemWidth), positionGeometry.x.mul(headSize), isHead),
                mix(positionGeometry.y.mul(stemHeight), positionGeometry.y.mul(headSize).add(stemHeight), isHead),
                mix(positionGeometry.z.mul(stemWidth), positionGeometry.z.mul(headSize), isHead),
            ).toVar()
            local.xz.assign(rotateUV(local.xz, yaw, vec2(0)))
            if (fade) local.mulAssign(fade)

            pos.assign(vec3(local.x.add(worldXZ.x), local.y, local.z.add(worldXZ.y)))
            // sampled at the anchor, not per vertex: the whole flower stands on one
            // terrain height, so a stem on a slope stays straight instead of shearing
            if (heightField) pos.y.addAssign(sampleHeight(heightField, worldXZ))

            // wind, same curve as grass: sway scales with height, weight bends the stem
            let windVec = flowerWindOffset(worldXZ).mul(stemHeight).mul(1.8)
            if (trampleAmt) windVec = windVec.mul(trampleAmt.oneMinus())
            windVec = windVec.toVar()
            pos.addAssign(vec3(windVec.x.mul(windWeight), 0, windVec.y.mul(windWeight)))
            // bend, don't stretch: drop by the arc approximation |w|²/2h
            const droop = windVec.dot(windVec).div(stemHeight.mul(2).max(1e-4)).min(stemHeight.mul(0.35))
            pos.y.subAssign(droop.mul(windWeight).mul(windWeight))

            // live interactor: flowers lean away from whoever is standing on them
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

    // part id picks the palette; constant across each quad, so a varying is enough
    const petal = mix(petalA, petalB, instanceData.w)
    const stemOrPetal = mix(stem, petal, step(0.5, part))
    const base = varying(mix(stemOrPetal, center, step(1.5, part)))

    // openness baked per vertex: 1 = exposed, 0 = buried in the grass
    const openness = vertexData.z

    if (grading) {
        const ao = varying(openness.oneMinus().mul(shadowIntensity).oneMinus())
        const dropShadow = createDropShadowCatcher()
        material.receivedShadowNode = dropShadow.receivedShadowNode
        // petal normals are noisy after wind bend — same call as grass, no core shadows
        material.outputNode = stylizedOutput(base, grading, { hasCoreShadows: false, aoNode: ao, dropShadowNode: dropShadow.shadowFactor })
    }
    else {
        const ao = varying(openness.oneMinus().mul(shadowIntensity))
        material.colorNode = mix(base, base.mul(0.35), ao)
    }

    // the node comes back out so a texture swap can reach it without a rebuild
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
    setDensity(options.density ?? 0.55)

    // the band feeds the baked coverage, so moving it has to re-sort and re-upload
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
