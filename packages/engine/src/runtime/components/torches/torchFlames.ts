import type { TresColor } from '@tresjs/core'
import { Color, DoubleSide, Group, LatheGeometry, Mesh, Object3D, Vector2, Vector3 } from 'three'
import { abs, clamp, cos, cross, dot, float, floor, Fn, fract, mix, modelNormalMatrix, modelPosition, normalGeometry, positionGeometry, positionViewDirection, select, sin, smoothstep, time, transformNormalToView, uniform, varying, vec3, vec4 } from 'three/tsl'
import { MeshLambertNodeMaterial, MeshStandardNodeMaterial } from 'three/webgpu'
import type { ColorRepresentation, Node } from 'three/webgpu'
import { createWindUniforms, windOffset, type WindSettings } from '../wind/wind'
import type { GradingContext, PointLight } from '../../grading/grading'
import { stylizedOutput } from '../../grading/stylizedOutput'
import { createTorchEmbers } from './torchEmbers'

export interface TorchFlamesOptions extends WindSettings {
    /** one flame per reference: position = flame base, uniform scale = flame height in metres */
    references: Object3D[]
    /** widest radius relative to the flame height. Read at creation */
    width?: number
    /** how fast the veins climb the flame, in flame heights per second */
    riseSpeed?: number
    displaceStrength?: number
    flicker?: number
    /** how far the tip bends downwind, in flame heights at full wind */
    windLean?: number
    /** 0 = fully graded like any prop, 1 = unlit glow that ignores the time of day */
    emission?: number
    /** HDR multiplier on the glow. Above 1 the flame feeds a bloom pass with threshold 1 */
    glowIntensity?: number
    coreStrength?: number
    rimStrength?: number
    coreLow?: TresColor
    coreMid?: TresColor
    coreHigh?: TresColor
    rimLow?: TresColor
    rimHigh?: TresColor
    /** sparks per flame. Read at creation, 0 turns them off */
    emberCount?: number
    /** ember sprite size in metres */
    emberSize?: number
    /** how high an ember climbs before it dies out, in flame heights */
    emberRise?: number
    /** how far the wind carries an ember over its life, in flame heights at full wind */
    emberDrift?: number
    /** pool of light each flame casts on graded materials. Needs `grading` */
    lightColor?: TresColor
    lightIntensity?: number
    lightRadius?: number
    lightFlicker?: number
    grading?: GradingContext | null
}

const PROFILE_STEPS = 40
const RADIAL_SEGMENTS = 24
// widest point of the teardrop, as a fraction of the height
const BULGE_AT = 0.25

const SWAY = 0.08
const MARBLE_SIZE = 0.4
const MARBLE_TURBULENCE = 5
const MARBLE_VEINS = 5
const DISPLACE_MID = 0.5
// the base stays pinned to the torch below this height
const BASE_MASK = 0.18
const TIP_CLAMP = 0.8
const NORMAL_EPS = 0.02
const OCTAVES = 3

const CORE_OFFSET = 0.8
const CORE_SCALE = 0.54
const CORE_MID_AT = 0.327
const RIM_STOPS = new Vector2(0, 0.523)
const MASK_FLOOR = 1
const POWER_A = 2
const POWER_B = 4
const RAMP_A = new Vector2(0, 1)
const RAMP_B = new Vector2(0.082, 1)

// Unit space: height 1, base at the origin. sqrt(t)·(1-t)^1.5 rounds the base and peaks at BULGE_AT.
export function createTorchFlameGeometry(width = 0.22) {
    const peak = Math.sqrt(BULGE_AT) * (1 - BULGE_AT) ** 1.5
    const points: Vector2[] = []
    for (let i = 0; i <= PROFILE_STEPS; i++) {
        const t = i / PROFILE_STEPS
        points.push(new Vector2(width * Math.sqrt(t) * (1 - t) ** 1.5 / peak, t))
    }
    return new LatheGeometry(points, RADIAL_SEGMENTS)
}

const hash13 = Fn(([p]: [any]) => {
    const q: any = fract(p.mul(0.1031)).toVar()
    q.addAssign(dot(q, q.zyx.add(31.32)))
    return fract(q.x.add(q.y).mul(q.z))
})

const valueNoise = Fn(([p]: [any]) => {
    const cell: any = floor(p).toVar()
    const f: any = fract(p)
    const u: any = f.mul(f).mul(f.mul(-2).add(3)).toVar()
    const n = (x: number, y: number, z: number) => hash13(cell.add(vec3(x, y, z)))
    return mix(
        mix(mix(n(0, 0, 0), n(1, 0, 0), u.x), mix(n(0, 1, 0), n(1, 1, 0), u.x), u.y),
        mix(mix(n(0, 0, 1), n(1, 0, 1), u.x), mix(n(0, 1, 1), n(1, 1, 1), u.x), u.y),
        u.z,
    )
})

function turbulence(p: Node<'vec3'>) {
    let sum: any = float(0)
    let amp = 1
    let total = 0
    for (let i = 0; i < OCTAVES; i++) {
        sum = sum.add(valueNoise(p.mul(2 ** i)).mul(amp))
        total += amp
        amp *= 0.5
    }
    return sum.div(total)
}

function marble(p: Node<'vec3'>) {
    const veins = p.x.add(p.y).add(p.z).mul(MARBLE_VEINS)
    return sin(veins.add(turbulence(p.div(MARBLE_SIZE)).mul(MARBLE_TURBULENCE))).mul(0.5).add(0.5)
}

const ramp3 = (c0: any, c1: any, c2: any, midAt: number, t: Node<'float'>) =>
    mix(mix(c0, c1, smoothstep(0, midAt, t)), c2, smoothstep(midAt, 1, t))

function createFlameUniforms(options: TorchFlamesOptions) {
    // raw Color, not a TSL color(): a node as the uniform value gives a zero-size GPU buffer
    const color = (value: TresColor | undefined, fallback: string) => uniform(new Color((value ?? fallback) as ColorRepresentation))
    return {
        riseSpeed: uniform(options.riseSpeed ?? 0.7),
        displaceStrength: uniform(options.displaceStrength ?? 0.12),
        flicker: uniform(options.flicker ?? 0.06),
        windLean: uniform(options.windLean ?? 0.6),
        emission: uniform(options.emission ?? 0.6),
        glowIntensity: uniform(options.glowIntensity ?? 2.5),
        coreStrength: uniform(options.coreStrength ?? 1.4),
        rimStrength: uniform(options.rimStrength ?? 1),
        coreLow: color(options.coreLow, '#ff4d00'),
        coreMid: color(options.coreMid, '#ff9d2e'),
        coreHigh: color(options.coreHigh, '#ffe6a8'),
        rimLow: color(options.rimLow, '#ff6a1a'),
        rimHigh: color(options.rimHigh, '#d81400'),
        emberSize: uniform(options.emberSize ?? 0.07),
        emberRise: uniform(options.emberRise ?? 1.5),
        emberDrift: uniform(options.emberDrift ?? 1),
        wind: createWindUniforms(options),
    }
}

type FlameUniforms = ReturnType<typeof createFlameUniforms>

function buildTorchFlameMaterial(uniforms: FlameUniforms, grading?: GradingContext | null) {
    const material = grading ? new MeshLambertNodeMaterial() : new MeshStandardNodeMaterial()
    material.side = DoubleSide

    // the CPU-side animator of the reference, moved into the shader
    const animator = vec3(sin(time.mul(2.6)).mul(SWAY), time.mul(uniforms.riseSpeed), cos(time.mul(1.8)).mul(SWAY))
    // world position decorrelates neighbouring torches
    const fieldOffset = modelPosition.sub(animator)
    const lean = windOffset(uniforms.wind)(modelPosition.xz).mul(uniforms.windLean) as unknown as Node<'vec2'>

    // positionGeometry, not positionLocal: these nodes also feed varyings, which are built after
    // positionLocal is reassigned to the displaced position
    const nor = normalGeometry.normalize()
    const mask = smoothstep(0, BASE_MASK, positionGeometry.y)

    // capped by the local radius: on the thin tip a larger push folds the surface through the axis
    const displace = (pos: Node<'vec3'>) => {
        const limit = pos.xz.length().mul(TIP_CLAMP)
        const amount = marble(pos.add(fieldOffset)).sub(DISPLACE_MID).mul(uniforms.displaceStrength).mul(mask)
        return pos.add(nor.mul(clamp(amount, limit.negate(), limit)))
    }
    // tip bends downwind on an arc |w|²/2 so it does not stretch
    const bend = (pos: Node<'vec3'>) => {
        const weight = pos.y.mul(pos.y)
        const sag = dot(lean, lean).mul(0.5)
        return pos.add(vec3(lean.x, sag.negate(), lean.y).mul(weight))
    }
    const deform = (pos: Node<'vec3'>) => bend(displace(pos))

    const axis = select(abs(nor.y).lessThan(0.99), vec3(0, 1, 0), vec3(1, 0, 0))
    const tangent = cross(axis, nor).normalize()
    const bitangent = cross(nor, tangent)
    const deformed = deform(positionGeometry)
    const deformedNormal = cross(
        deform(positionGeometry.add(tangent.mul(NORMAL_EPS))).sub(deformed),
        deform(positionGeometry.add(bitangent.mul(NORMAL_EPS))).sub(deformed),
    ).normalize()

    material.positionNode = deformed

    // color bands follow the flame along its length, so the height is read before the bend
    const height = varying(displace(positionGeometry).y)
    const viewNormal = varying(transformNormalToView(deformedNormal))
    const worldNormal = varying(modelNormalMatrix.mul(deformedNormal))
    const phase = modelPosition.x.add(modelPosition.z)

    const facing = float(1).sub(abs(dot(viewNormal.normalize(), positionViewDirection)))
    const lifted = mix(facing, MASK_FLOOR, 0.5)
    const a = smoothstep(RAMP_A.x, RAMP_A.y, lifted.pow(POWER_A))
    const b = smoothstep(RAMP_B.x, RAMP_B.y, lifted.pow(POWER_B))
    // colour dodge of the two rim ramps
    const rimMask = select(a.lessThanEqual(0), float(0), a.div(float(1).sub(b).max(1e-4)).min(1))

    const t = time.add(phase)
    const flicker = sin(height.mul(9).sub(t.mul(6))).add(sin(height.mul(17).sub(t.mul(9.3)))).mul(0.5)
    const coreT = smoothstep(0, 1, flicker.mul(uniforms.flicker).add(CORE_OFFSET).sub(height.mul(CORE_SCALE)))
    const rimT = smoothstep(0, 1, float(1).sub(height))

    const core = ramp3(uniforms.coreLow, uniforms.coreMid, uniforms.coreHigh, CORE_MID_AT, coreT).mul(uniforms.coreStrength)
    const rim = mix(uniforms.rimLow, uniforms.rimHigh, smoothstep(RIM_STOPS.x, RIM_STOPS.y, rimT)).mul(uniforms.rimStrength)
    const flame = mix(core, rim, rimMask)

    if (grading) {
        const graded = stylizedOutput(flame, grading, { hasCoreShadows: true, hasPointLights: false, normalNode: worldNormal.normalize() })
        // unfogged: the night fog would otherwise swallow the flame
        const glow = flame.mul(uniforms.glowIntensity)
        material.outputNode = vec4(mix(graded.rgb, glow, uniforms.emission), 1)
    }
    else {
        material.colorNode = flame
        ;(material as MeshStandardNodeMaterial).emissiveNode = flame.mul(uniforms.emission).mul(uniforms.glowIntensity)
    }

    return material
}

export function createTorchFlames(options: TorchFlamesOptions) {
    const width = options.width ?? 0.22
    const geometry = createTorchFlameGeometry(width)
    const uniforms = createFlameUniforms(options)
    const material = buildTorchFlameMaterial(uniforms, options.grading)

    const group = new Group()
    group.name = 'TorchFlames'
    for (const reference of options.references) {
        const flame = new Mesh(geometry, material)
        flame.name = 'TorchFlame'
        flame.position.copy(reference.position)
        flame.scale.copy(reference.scale)
        group.add(flame)
    }

    const emberCount = options.emberCount ?? 12
    const embers = emberCount > 0 && options.references.length
        ? createTorchEmbers(options.references, emberCount, width, uniforms)
        : null
    if (embers) group.add(embers.sprite)

    const lightColor = new Color((options.lightColor ?? '#ff8a3d') as ColorRepresentation)
    const lights: PointLight[] = options.references.map(reference => ({
        // the flame's middle: scale.y is the flame height
        position: new Vector3(0, reference.scale.y * 0.5, 0).add(reference.position),
        radius: options.lightRadius ?? 6,
        color: lightColor,
        intensity: options.lightIntensity ?? 1.5,
        flicker: options.lightFlicker ?? 0.15,
    }))
    const removeLights = options.grading?.addPointLights(lights)

    function setLight(settings: { color?: TresColor, intensity?: number, radius?: number, flicker?: number }) {
        if (settings.color !== undefined) lightColor.set(new Color(settings.color as ColorRepresentation))
        for (const light of lights) {
            if (settings.intensity !== undefined) light.intensity = settings.intensity
            if (settings.radius !== undefined) light.radius = settings.radius
            if (settings.flicker !== undefined) light.flicker = settings.flicker
        }
        options.grading?.updatePointLights()
    }

    return {
        group,
        uniforms,
        setLight,
        dispose: () => {
            removeLights?.()
            geometry.dispose()
            material.dispose()
            embers?.dispose()
        },
    }
}
