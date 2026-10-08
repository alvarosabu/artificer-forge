import type { TresColor } from '@tresjs/core'
import { BufferAttribute, BufferGeometry, Color, DoubleSide, InstancedBufferAttribute, Object3D, Vector3 } from 'three'
import { attribute, Fn, instance, instancedBufferAttribute, mix, positionLocal, sin, uniform, uv, varying, vec3 } from 'three/tsl'
import { MeshLambertNodeMaterial, MeshStandardNodeMaterial } from 'three/webgpu'
import type { ColorRepresentation, Node, UniformNode } from 'three/webgpu'
import { createWindUniforms, windOffset, type WindSettings, type WindUniforms } from '../wind/wind'
import type { GradingContext } from '../../grading/grading'
import { createDropShadowCatcher, stylizedOutput } from '../../grading/stylizedOutput'

export interface PalmFrondsOptions extends WindSettings {
    /** one crown per reference: position = frond origin, Y rotation = yaw, uniform scale = frond length in metres */
    references: Object3D[]
    /** read at creation, a change needs a remount */
    fronds?: number
    /** short folded spears in the middle, so the crown is not bald from above. Read at creation */
    youngFronds?: number
    /** rachis segments per frond. Read at creation */
    segments?: number
    /** leaflets on each side of a frond. Read at creation */
    leaflets?: number
    /** radians between a leaflet and the rachis, toward the tip. Low = swept spear, PI/2 = fern comb. Read at creation */
    leafletAngle?: number
    /** how far the leaflets tilt below the frond, in radians. Read at creation */
    leafletHang?: number
    /** longest leaflet relative to the frond length. Read at creation */
    leafletLength?: number
    /** leaflet width relative to its own length. Read at creation */
    leafletWidth?: number
    /** how far the lower fronds fall. Read at creation */
    droop?: number
    /** frond base */
    colorA?: TresColor
    /** frond tip */
    colorB?: TresColor
    seed?: string
    grading?: GradingContext | null
}

type PalmFrondsMaterial = MeshLambertNodeMaterial | MeshStandardNodeMaterial

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

const UP = new Vector3(0, 1, 0)
// real crowns grow on this spiral, so it fills the ring without the gaps random yaws leave
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))
// past this the tip would curl back under the crown
const MIN_FROND_ANGLE = -1.45
// world height that floor-level crowns rest their hanging tips on
const PALM_GROUND_Y = 0.02
// leaflets attach between any two rachis samples, so the spine is integrated finer than it is drawn
const SPINE_STEPS = 48
// bare petiole at the base of every frond
const LEAFLET_START = 0.12
// where a leaflet is widest, as a fraction of its length
const LEAFLET_WIDEST = 0.3

interface CrownTemplateOptions {
    fronds: number
    youngFronds: number
    segments: number
    leaflets: number
    leafletAngle: number
    leafletHang: number
    leafletLength: number
    leafletWidth: number
    droop: number
}

interface SpineSample {
    point: Vector3
    tangent: Vector3
    side: Vector3
    normal: Vector3
}

class TemplateWriter {
    positions: number[] = []
    normals: number[] = []
    uvs: number[] = []
    frondRandoms: number[] = []
    indices: number[] = []
    private toVertex = new Vector3()
    private bent = new Vector3()

    /** returns the vertex index */
    push(vertex: Vector3, normal: Vector3, leafT: number, frondT: number, random: number) {
        this.positions.push(vertex.x, vertex.y, vertex.z)
        // bent toward the crown centre so the crown shades as one mass, not loose blades.
        // Left unnormalized on purpose: the length softens the ramp, as in foliage.ts
        this.toVertex.copy(vertex).normalize()
        this.bent.copy(normal).lerp(this.toVertex, 0.4)
        this.normals.push(this.bent.x, this.bent.y, this.bent.z)
        this.uvs.push(leafT, frondT)
        this.frondRandoms.push(random)
        return this.positions.length / 3 - 1
    }
}

// The frond arc, integrated from the origin. The angle drops along the frond, so it rises
// first and droops after: an arc, not a hinge.
function buildSpine(dir: Vector3, length: number, startAngle: number, bend: number, roll: number): SpineSample[] {
    const side = new Vector3().crossVectors(dir, UP)
    const samples: SpineSample[] = []
    const point = new Vector3().addScaledVector(dir, 0.03)
    const stepLength = length / SPINE_STEPS

    for (let i = 0; i <= SPINE_STEPS; i++) {
        const t = i / SPINE_STEPS
        const angle = Math.max(MIN_FROND_ANGLE, startAngle - bend * t * t)
        const tangent = dir.clone().multiplyScalar(Math.cos(angle)).addScaledVector(UP, Math.sin(angle))
        // the frond twists a little toward the tip, so it does not lie in one plane
        const rolledSide = side.clone().applyAxisAngle(tangent, roll * t)
        const normal = new Vector3().crossVectors(rolledSide, tangent).normalize()
        if (normal.y < 0) normal.negate()

        samples.push({ point: point.clone(), tangent, side: rolledSide, normal })
        point.addScaledVector(tangent, stepLength)
    }
    return samples
}

function sampleSpine(spine: SpineSample[], t: number) {
    return spine[Math.min(SPINE_STEPS, Math.round(t * SPINE_STEPS))]!
}

// A thin ribbon. It goes edge-on from some angles, which is fine: the leaflets carry the silhouette.
function writeRachis(writer: TemplateWriter, spine: SpineSample[], segments: number, halfWidth: number, random: number) {
    const vertex = new Vector3()
    let previous = -1
    for (let i = 0; i <= segments; i++) {
        const t = i / segments
        const sample = sampleSpine(spine, t)
        // tapers to a point so the frond tip is not cut square
        const w = halfWidth * (1 - 0.8 * t)
        const left = writer.push(vertex.copy(sample.point).addScaledVector(sample.side, -w), sample.normal, 0, t, random)
        writer.push(vertex.copy(sample.point).addScaledVector(sample.side, w), sample.normal, 0, t, random)
        if (previous >= 0) writer.indices.push(previous, left, previous + 1, previous + 1, left, left + 1)
        previous = left
    }
}

// One stiff leaflet: a straight blade, widest near the base, sharp at the tip, with the midrib
// lifted so the two halves fold. Straight is the point: a curved or drooping leaflet reads soft.
function writeLeaflet(writer: TemplateWriter, sample: SpineSample, frondT: number, sideSign: number, length: number, angle: number, hang: number, widthRatio: number, random: number) {
    const dir = sample.tangent.clone().multiplyScalar(Math.cos(angle)).addScaledVector(sample.side, sideSign * Math.sin(angle))
    dir.multiplyScalar(Math.cos(hang)).addScaledVector(sample.normal, -Math.sin(hang)).normalize()
    const across = new Vector3().crossVectors(dir, sample.normal).normalize()
    const leafNormal = new Vector3().crossVectors(across, dir).normalize()
    if (leafNormal.y < 0) leafNormal.negate()

    const halfWidth = length * widthRatio * 0.5
    const widest = sample.point.clone().addScaledVector(dir, length * LEAFLET_WIDEST)
    // each half of the fold faces a little outward, so the crease catches light on one side
    const minusNormal = leafNormal.clone().addScaledVector(across, -0.6)
    const plusNormal = leafNormal.clone().addScaledVector(across, 0.6)

    const vertex = new Vector3()
    const base = writer.push(sample.point, leafNormal, 0, frondT, random)
    const minus = writer.push(vertex.copy(widest).addScaledVector(across, -halfWidth), minusNormal, LEAFLET_WIDEST, frondT, random)
    const midrib = writer.push(vertex.copy(widest).addScaledVector(leafNormal, halfWidth * 0.5), leafNormal, LEAFLET_WIDEST, frondT, random)
    const plus = writer.push(vertex.copy(widest).addScaledVector(across, halfWidth), plusNormal, LEAFLET_WIDEST, frondT, random)
    const tip = writer.push(vertex.copy(sample.point).addScaledVector(dir, length), leafNormal, 1, frondT, random)

    writer.indices.push(
        base, minus, midrib, base, midrib, plus,
        minus, tip, midrib, midrib, tip, plus,
    )
}

// Unit space: a frond of length ~1 grows from the origin.
function buildCrownTemplate(rng: () => number, options: CrownTemplateOptions) {
    const { fronds, youngFronds, segments, leaflets, leafletAngle, leafletHang, leafletLength, leafletWidth, droop } = options
    const writer = new TemplateWriter()
    const dir = new Vector3()

    const total = fronds + youngFronds
    for (let f = 0; f < total; f++) {
        const young = f >= fronds
        // 0 = oldest, lowest frond; 1 = newest, highest. Older fronds start lower and droop more
        const age = young ? 1 : (f + rng()) / fronds
        const phi = f * GOLDEN_ANGLE + (rng() - 0.5) * 0.3
        dir.set(Math.cos(phi), 0, Math.sin(phi))

        const length = young ? 0.4 + rng() * 0.15 : (1 - 0.2 * age) * (0.9 + rng() * 0.2)
        const startAngle = young ? 1.35 + rng() * 0.15 : -0.25 + 1.1 * age
        const bend = young ? 0.15 : droop * (1.4 - 0.7 * age) * (0.85 + rng() * 0.3)
        const roll = (rng() - 0.5) * 0.6
        const random = rng()
        const spine = buildSpine(dir, length, startAngle, bend, roll)

        writeRachis(writer, spine, segments, 0.012 * length, random)

        // a young frond is still a folded spear: its leaflets press forward and up
        const angle = young ? 0.15 : leafletAngle
        const hang = young ? -0.5 : leafletHang
        const maxLength = leafletLength * length * (young ? 0.6 : 1)

        for (const sideSign of [-1, 1]) {
            for (let j = 0; j < leaflets; j++) {
                // the two sides are offset by half a step, so leaflets alternate like the sketch
                const slot = (j + (sideSign > 0 ? 0.25 : 0.75) + (rng() - 0.5) * 0.3) / leaflets
                const t = LEAFLET_START + (0.97 - LEAFLET_START) * slot
                const u = (t - LEAFLET_START) / (1 - LEAFLET_START)
                // longest past the base, still a fair size at the tip where the leaflets cluster
                const envelope = 0.35 + 0.65 * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.1)), 0.7)
                writeLeaflet(
                    writer,
                    sampleSpine(spine, t),
                    t,
                    sideSign,
                    maxLength * envelope * (0.9 + rng() * 0.2),
                    // leaflets near the tip sweep further forward
                    angle * (1 - 0.45 * u),
                    hang * (0.7 + 0.6 * u),
                    leafletWidth,
                    random,
                )
            }
        }
    }

    return writer
}

export function createPalmFrondsGeometry(options: PalmFrondsOptions) {
    const {
        fronds = 16, youngFronds = 3, segments = 10, leaflets = 14, leafletAngle = 0.55,
        leafletHang = 0.35, leafletLength = 0.32, leafletWidth = 0.16, droop = 1.1, seed = 'palms',
    } = options
    const rng = mulberry32(hashSeed(seed))
    const template = buildCrownTemplate(rng, { fronds, youngFronds, segments, leaflets, leafletAngle, leafletHang, leafletLength, leafletWidth, droop })

    const geometry = new BufferGeometry()
    geometry.setIndex(template.indices)
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(template.positions), 3))
    geometry.setAttribute('normal', new BufferAttribute(new Float32Array(template.normals), 3))
    geometry.setAttribute('uv', new BufferAttribute(new Float32Array(template.uvs), 2))
    geometry.setAttribute('frondRandom', new BufferAttribute(new Float32Array(template.frondRandoms), 1))
    geometry.computeBoundingSphere()

    const { references } = options
    const matrices = new InstancedBufferAttribute(new Float32Array(references.length * 16), 16)
    // world xz + scale for the wind: instance() hides the matrix from the authored shader code
    const crowns = new InstancedBufferAttribute(new Float32Array(references.length * 4), 4)
    references.forEach((reference, i) => {
        reference.matrixWorld.toArray(matrices.array, i * 16)
        const e = reference.matrixWorld.elements
        crowns.setXYZW(i, e[12]!, e[14]!, reference.matrixWorld.getMaxScaleOnAxis(), rng())
    })

    return { geometry, matrices, crowns, count: references.length }
}

function buildPalmFrondsMaterial(options: {
    colorA: UniformNode<'color', Color>
    colorB: UniformNode<'color', Color>
    matrices: InstancedBufferAttribute
    crowns: InstancedBufferAttribute
    windUniforms: WindUniforms
    grading?: GradingContext | null
}) {
    const { colorA, colorB, matrices, crowns, windUniforms, grading } = options
    const material: PalmFrondsMaterial = grading ? new MeshLambertNodeMaterial() : new MeshStandardNodeMaterial()

    // fronds are seen from below as often as from above
    material.side = DoubleSide
    // three flips the shadow side of a FrontSide material to BackSide, and a single-sided blade
    // has no back shell: half the leaflets would cast nothing, without a warning
    material.shadowSide = DoubleSide

    // 0 at the leaflet base, 1 at its tip; 0 on the rachis
    const leafT = uv().x
    // where the vertex sits along the frond. A whole leaflet shares its attachment value, so it
    // rides the rachis rigidly in the wind: that is the stiffness
    const frondT = uv().y
    const frondRandom = attribute<'float'>('frondRandom', 'float')
    // @types/three returns Node<string>, which hides the swizzles
    const crown = instancedBufferAttribute(crowns, 'vec4') as unknown as Node<'vec4'>
    const frondWindOffset = windOffset(windUniforms)

    material.positionNode = Fn(() => {
        // see foliage.ts: r184+ instance() signature, @types/three still has the old one
        ;(instance as unknown as (matrices: InstancedBufferAttribute) => void)(matrices)
        // positionLocal must stay a pure expression: instance() writes it AFTER these statements,
        // so a toVar() would snapshot the pre-instance value
        const scale = crown.z
        const wind = frondWindOffset(crown.xy).mul(scale).mul(0.35)
        const weight = frondT.mul(frondT)
        // tips flap up and down out of phase, on top of the shared crown sway
        const flap = sin(windUniforms.localTime.mul(9).add(frondRandom.mul(6.28)).add(frondT.mul(3)))
            .mul(windUniforms.strength).mul(scale).mul(0.06).mul(frondT)
        // arc approximation |w|²/2L so the frond bends instead of stretching
        const sag = wind.dot(wind).div(scale.mul(2).max(1e-4))
        const bent = positionLocal.add(vec3(wind.x.mul(weight), flap.sub(sag.mul(weight)), wind.y.mul(weight)))
        // floor-level crowns rest their hanging fronds on the floor. Flat floor only:
        // over terrain this needs the height field
        return vec3(bent.x, bent.y.max(PALM_GROUND_Y), bent.z)
    })()

    // skewed per frond and per crown so neighbours do not share one palette; leaflet tips lighter
    const ramp = frondT.mul(mix(0.8, 1.2, frondRandom.add(crown.w).fract())).add(leafT.mul(0.25)).clamp(0, 1)
    const base = varying(mix(colorA, colorB, ramp))
    // the base sits deep inside the crown and gets little light
    const ao = varying(frondT.mul(1.4).min(1).mul(0.6).add(0.4))

    if (grading) {
        const dropShadow = createDropShadowCatcher()
        material.receivedShadowNode = dropShadow.receivedShadowNode
        material.outputNode = stylizedOutput(base, grading, {
            hasCoreShadows: true,
            aoNode: ao,
            dropShadowNode: dropShadow.shadowFactor,
        })
    }
    else {
        material.colorNode = base.mul(ao)
    }

    return material
}

export function createPalmFronds(options: PalmFrondsOptions) {
    const { geometry, matrices, crowns, count } = createPalmFrondsGeometry(options)

    // raw Color, not a TSL color(): a node as the uniform value gives a zero-size GPU buffer
    const colorA = uniform(new Color((options.colorA ?? '#5f7d2c') as ColorRepresentation))
    const colorB = uniform(new Color((options.colorB ?? '#a9c45a') as ColorRepresentation))
    const windUniforms = createWindUniforms(options)
    const material = buildPalmFrondsMaterial({ colorA, colorB, matrices, crowns, windUniforms, grading: options.grading })

    return {
        geometry,
        material,
        count,
        uniforms: { colorA, colorB, wind: windUniforms },
        dispose: () => {
            geometry.dispose()
            material.dispose()
        },
    }
}
