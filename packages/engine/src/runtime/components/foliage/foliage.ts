import { TresColor } from "@tresjs/core"
import { BufferGeometry, Color, DoubleSide, InstancedBufferAttribute, Object3D, PlaneGeometry, Quaternion, Spherical, StaticDrawUsage, Texture, Vector3 } from "three"
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js"
import { float, Fn, instance, mix, normalWorld, positionLocal, rotateUV, texture, uniform, uv, vec2, vec3, vec4 } from "three/tsl"
import { MeshBasicNodeMaterial, MeshStandardNodeMaterial } from "three/webgpu"
import type { UniformNode } from "three/webgpu"
import { createWindUniforms, windOffset, type WindSettings, type WindUniforms } from "../wind/wind"
import { trampleUv, type TrampleMap } from "../../trample/trample"
import type { GradingContext } from "../../grading/grading"
import { stylizedOutput } from "../../grading/stylizedOutput"

export interface FoliageOptions extends WindSettings {
    references: Object3D[]
    amount: number
    size: number
    colorA: TresColor
    colorB: TresColor
    seed?: string
    foliageTexture?: Texture | null
    /** legacy ramp/shadow direction — ignored when grading is set (direction lives in grading) */
    lightingDirection?: Vector3
    cameraForward?: Vector3
    trample?: TrampleMap | null
    grading?: GradingContext | null
}

type FoliageMaterial = MeshBasicNodeMaterial | MeshStandardNodeMaterial

const DEFAULT_LIGHTING_DIR = new Vector3(1, 1, 0).normalize()

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

function buildInstanceMatrices(
    references: Object3D[],
    rng: () => number,
    cameraForward: Vector3,
): InstancedBufferAttribute {
    const count = references.length
    const data = new Float32Array(count * 16)
    const dummy = new Object3D()

    for (let i = 0; i < count; i++) {
        const ref = references[i]

        dummy.position.setFromMatrixPosition(ref.matrixWorld)
        dummy.scale.setScalar(ref.matrixWorld.getMaxScaleOnAxis())

        const angle = rng() * Math.PI * 2
        dummy.up.set(Math.sin(angle), Math.cos(angle), 0)
        dummy.lookAt(
            dummy.position.x + cameraForward.x,
            dummy.position.y + cameraForward.y,
            dummy.position.z + cameraForward.z,
        )

        dummy.updateMatrix()
        dummy.matrix.toArray(data, i * 16)
    }

    const attr = new InstancedBufferAttribute(data, 16)
    attr.setUsage(StaticDrawUsage)
    return attr
}

function buildClusterGeometry(rng: () => number, amount: number, size: number): BufferGeometry {
    const planes: BufferGeometry[] = []
    const spherical = new Spherical()
    const normal = new Vector3()
    const surfaceNormal = new Vector3()

    for (let i = 0; i < amount; i++) {
        const plane = new PlaneGeometry(size, size)

        spherical.set(
            1 - Math.pow(rng(), 3),
            Math.acos(2 * rng() - 1),
            rng() * Math.PI * 2,
        )
        const position = new Vector3().setFromSpherical(spherical)

        const rotZ = rng() * Math.PI * 2
        plane.rotateZ(rotZ)
        const outward = position.clone().normalize()
        const q = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), outward)
        plane.applyQuaternion(q)
        plane.translate(position.x, position.y, position.z)

        // Lerp normals 85% toward sphere surface normal — do NOT normalize
        const posArr = plane.attributes.position.array as Float32Array
        const normArr = plane.attributes.normal.array as Float32Array

        for (let v = 0; v < 4; v++) {
            const vx = posArr[v * 3]
            const vy = posArr[v * 3 + 1]
            const vz = posArr[v * 3 + 2]

            surfaceNormal.set(vx, vy, vz).normalize()
            normal.set(normArr[v * 3], normArr[v * 3 + 1], normArr[v * 3 + 2])
            normal.lerp(surfaceNormal, 0.85)
            // Intentionally NOT normalized — produces softer lighting

            normArr[v * 3]     = normal.x
            normArr[v * 3 + 1] = normal.y
            normArr[v * 3 + 2] = normal.z
        }

        planes.push(plane)
    }

    return mergeGeometries(planes)
}

// Wind flutters the leaves by rotating the alpha-texture UVs (no positional
// movement, keeps the cluster silhouette stable). Shadow pass keeps plain UVs.
function foliageAlphaUv(wind: WindUniforms) {
    const foliageWindOffset = windOffset(wind)
    return rotateUV(uv(), foliageWindOffset(positionLocal.xz).length().mul(2.2), vec2(0.5))
}

export function applyFoliageTexture(material: FoliageMaterial, tex: Texture, wind: WindUniforms, grading?: GradingContext | null) {
    // graded path skips opacityNode — alpha routes through the stylized finish instead
    if (!grading) material.opacityNode = texture(tex, foliageAlphaUv(wind)).r
    material.castShadowNode = Fn(() => {
        const alphaColor = texture(tex, uv()).r
        alphaColor.lessThan(0.5).discard()
        return vec4(0, 1, 1, 1)  // WebGPU shadow pass convention — not RGBA color
    })()
    material.needsUpdate = true
}

// normal-ramped base (the pre-grading look): cluster normals are lerped toward the
// sphere, so the A→B ramp shades the blob softly and separates the leaves — the
// finish's core shadow alone can't do that when shadowColor is bright
function gradedFoliageOutput(
    grading: GradingContext,
    colorAUniform: UniformNode<'color', Color>,
    colorBUniform: UniformNode<'color', Color>,
    tex: Texture | null | undefined,
    wind: WindUniforms,
) {
    const ramp = normalWorld.dot(grading.uniforms.lightDirection).smoothstep(0, 1)
    const baseColor = mix(colorAUniform, colorBUniform, ramp)
    const alpha = tex ? texture(tex, foliageAlphaUv(wind)).r : float(1)
    return stylizedOutput(baseColor, grading, {
        hasCoreShadows: true,
        alphaNode: alpha,
        alphaTest: 0.3, // replaces material.alphaTest — discarded after fog so cutout edges don't pop
    })
}

function buildFoliageMaterial(options: {
    colorAUniform: UniformNode<'color', Color>,
    colorBUniform: UniformNode<'color', Color>,
    lightingDirUniform: UniformNode<'vec3', Vector3>,
    foliageTexture?: Texture | null,
    instanceMatrix: InstancedBufferAttribute,
    windUniforms: WindUniforms,
    trample?: TrampleMap | null,
    grading?: GradingContext | null,
}) {
    const { colorAUniform, colorBUniform, lightingDirUniform, foliageTexture, instanceMatrix, windUniforms, trample, grading } = options
    // grading IS the lighting — graded foliage is unlit
    const material: FoliageMaterial = grading ? new MeshBasicNodeMaterial() : new MeshStandardNodeMaterial()

    material.side = DoubleSide
    material.depthWrite = true
    material.transparent = false
    if (!grading) material.alphaTest = 0.3 // graded path discards inside the finish instead

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    material.positionNode = Fn(({ object }: { object: any }) => {
        instance(object.count, instanceMatrix).toStack()
        if (!trample) return positionLocal
        // instance() assigns the transform to positionLocal at build time, AFTER any
        // statements authored here — so no toVar()/assign on it (a var would snapshot the
        // pre-instance value). A pure expression evaluates at the output, post-instance,
        // where xz is world space (instance matrices carry the world translation).
        const trampleAmt = texture(trample.texture, trampleUv(trample.uniforms, positionLocal.xz)).r
        // squash the cluster toward the ground (y=0: references sit at ground level) where trampled
        return vec3(positionLocal.x, positionLocal.y.mul(trampleAmt.mul(0.6).oneMinus()), positionLocal.z)
    })()

    if (grading) {
        material.outputNode = gradedFoliageOutput(grading, colorAUniform, colorBUniform, foliageTexture, windUniforms)
    }
    else {
        material.colorNode = Fn(() => {
            const mixStrength = normalWorld.dot(lightingDirUniform).smoothstep(0, 1)
            return mix(colorAUniform, colorBUniform, mixStrength)
        })()

        material.receivedShadowPositionNode = positionLocal.add(
            lightingDirUniform.mul(1), // shadowOffset uniform, default 1
        )
    }

    if (foliageTexture) {
        applyFoliageTexture(material, foliageTexture, windUniforms, grading)
    }

    return material
}

export function createFoliage(options: FoliageOptions) {
    const {
        references,
        amount = 80,
        size = 0.8,
        colorA,
        colorB,
        foliageTexture,
        lightingDirection,
        seed,
        cameraForward = new Vector3(0, 0, -1),
        trample,
        grading,
    } = options
    const rng = mulberry32(hashSeed(seed || ''))
    const geometry = buildClusterGeometry(rng, amount, size)
    const instanceMatrix = buildInstanceMatrices(references, rng, cameraForward)

    // Pass raw Three.js objects to uniform() — NOT TSL nodes like color()/vec3()
    // Passing a TSL node as the uniform value causes zero-size GPU buffers
    const colorAUniform = uniform(new Color(colorA as Color))
    const colorBUniform = uniform(new Color(colorB as Color))
    const lightingDirUniform = uniform((lightingDirection ?? DEFAULT_LIGHTING_DIR).clone())
    const windUniforms = createWindUniforms(options)

    const material = buildFoliageMaterial({
        colorAUniform,
        colorBUniform,
        lightingDirUniform,
        foliageTexture,
        instanceMatrix,
        windUniforms,
        trample,
        grading,
    })

    return {
        geometry,
        material,
        uniforms: { colorA: colorAUniform, colorB: colorBUniform, lightingDir: lightingDirUniform, wind: windUniforms },
        count: references.length,
        // texture can arrive after mount — rewire the alpha for whichever path is active
        setTexture: (tex: Texture) => {
            applyFoliageTexture(material, tex, windUniforms, grading)
            if (grading) material.outputNode = gradedFoliageOutput(grading, colorAUniform, colorBUniform, tex, windUniforms)
        },
        dispose: () => {
            geometry.dispose()
            material.dispose()
        },
    }
}
