import { TresColor } from "@tresjs/core"
import { BufferAttribute, BufferGeometry, Color, FrontSide, InstancedBufferAttribute, Object3D, PlaneGeometry, Spherical, StaticDrawUsage, Texture, Vector3 } from "three"
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js"
import { attribute, cameraWorldMatrix, float, Fn, instance, instancedBufferAttribute, mix, normalWorld, positionLocal, positionWorld, rotateUV, texture, uniform, uv, varying, vec2, vec3, vec4 } from "three/tsl"
import { MeshLambertNodeMaterial, MeshStandardNodeMaterial } from "three/webgpu"
import type { UniformNode } from "three/webgpu"
import { createWindUniforms, windOffset, type WindSettings, type WindUniforms } from "../wind/wind"
import { trampleUv, type TrampleMap } from "../../trample/trample"
import type { GradingContext } from "../../grading/grading"
import { createDropShadowCatcher, stylizedOutput } from "../../grading/stylizedOutput"

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
    trample?: TrampleMap | null
    grading?: GradingContext | null
}

type FoliageMaterial = MeshLambertNodeMaterial | MeshStandardNodeMaterial

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

// The cluster transform carries NO billboard rotation — the quads face the camera in
// the vertex shader instead (see billboardOffset), so this is only place + size + a
// random yaw. The yaw exists to vary the baked fake-spherical normals between bushes:
// without it every cluster would catch the light on exactly the same side.
function buildInstanceMatrices(
    references: Object3D[],
    rng: () => number,
): { matrices: InstancedBufferAttribute, scales: InstancedBufferAttribute } {
    const count = references.length
    const data = new Float32Array(count * 16)
    const scaleData = new Float32Array(count)
    const dummy = new Object3D()

    for (let i = 0; i < count; i++) {
        const ref = references[i]
        const scale = ref.matrixWorld.getMaxScaleOnAxis()

        dummy.position.setFromMatrixPosition(ref.matrixWorld)
        dummy.scale.setScalar(scale)
        dummy.rotation.set(0, rng() * Math.PI * 2, 0)

        dummy.updateMatrix()
        dummy.matrix.toArray(data, i * 16)
        // quad corners are expanded after the instance transform, so they miss its
        // scale — hand it to the shader separately or every bush gets 1.0-sized leaves
        scaleData[i] = scale
    }

    const matrices = new InstancedBufferAttribute(data, 16)
    matrices.setUsage(StaticDrawUsage)
    const scales = new InstancedBufferAttribute(scaleData, 1)
    scales.setUsage(StaticDrawUsage)
    return { matrices, scales }
}

function buildClusterGeometry(rng: () => number, amount: number, size: number): BufferGeometry {
    const planes: BufferGeometry[] = []
    const spherical = new Spherical()
    const normal = new Vector3()

    for (let i = 0; i < amount; i++) {
        const plane = new PlaneGeometry(size, size)

        spherical.set(
            1 - Math.pow(rng(), 3),
            Math.acos(2 * rng() - 1),
            rng() * Math.PI * 2,
        )
        const position = new Vector3().setFromSpherical(spherical)

        // Planes are only spun in-plane, never tilted toward the sphere surface: every
        // quad is turned to face the camera in the vertex shader, so it always shows its
        // full leaf silhouette. Tilting them outward turns the ones near the silhouette
        // edge-on and the blob reads as a pile of shards.
        plane.rotateZ(rng() * Math.PI * 2)

        // rotateZ keeps the quad in the XY plane, so its xy IS the spun corner offset.
        // Grab it before translating — the shader re-applies it along the camera axes.
        const posArr = plane.attributes.position.array as Float32Array
        const cornerArr = new Float32Array(8)
        for (let v = 0; v < 4; v++) {
            cornerArr[v * 2] = posArr[v * 3]
            cornerArr[v * 2 + 1] = posArr[v * 3 + 1]
        }

        plane.translate(position.x, position.y, position.z)
        const outward = position.clone().normalize()

        // Lerp normals 85% toward sphere surface normal — do NOT normalize
        const normArr = plane.attributes.normal.array as Float32Array
        // baked vertex AO: depth into the cluster (0 = core, 1 = surface)
        const aoArr = new Float32Array(4)

        for (let v = 0; v < 4; v++) {
            const vx = posArr[v * 3]
            const vy = posArr[v * 3 + 1]
            const vz = posArr[v * 3 + 2]

            // Fake spherical normals: start from the vertex position (keeps a little
            // per-corner variation) and pull 85% toward the plane's outward direction.
            // Intentionally NOT normalized — produces softer lighting.
            normal.set(vx, vy, vz).lerp(outward, 0.85)

            normArr[v * 3]     = normal.x
            normArr[v * 3 + 1] = normal.y
            normArr[v * 3 + 2] = normal.z

            // radius distribution (1 - rng³) piles planes near the surface, so raw
            // distance bakes to ~1 everywhere — ramp occlusion 3× faster than depth
            const depth = Math.max(0, 1 - Math.hypot(vx, vy, vz))
            aoArr[v] = 1 - Math.min(1, depth * 3)
        }
        plane.setAttribute('ao', new BufferAttribute(aoArr, 1))
        plane.setAttribute('corner', new BufferAttribute(cornerArr, 2))

        // Collapse the quad onto its centre: `position` now carries the leaf ANCHOR,
        // repeated across all four verts, and the shader rebuilds the quad from
        // `corner`. Normals and ao above were still measured at the real vertex
        // positions, so the fake spherical shading is unchanged.
        for (let v = 0; v < 4; v++) {
            posArr[v * 3]     = position.x
            posArr[v * 3 + 1] = position.y
            posArr[v * 3 + 2] = position.z
        }

        planes.push(plane)
    }

    return mergeGeometries(planes)
}

// True per-frame billboard: rebuild the quad around its anchor along the camera's own
// right/up axes, so every leaf faces the viewer at any orbit angle. Baking the facing
// into the instance matrix (Bruno's approach) is cheaper but only holds up from the one
// angle his camera is locked to. cameraWorldMatrix follows whichever camera is rendering,
// so the shadow pass turns the quads toward the light — which is what we want there.
// w=0 drops the translation column, leaving just the rotation basis.
//
// The wind flutter spins the QUAD, not the texture UV. Rotating the UV (Bruno's
// approach) swings the sampled square outside [0,1] — the angle here reaches ~2 rad,
// which overshoots the texture by ~20% at the corners. Outside, clamp-to-edge repeats
// the SDF's black border, so the alpha test slices straight-edged chunks off any leaf
// near the quad corner. Spinning the corner offsets instead is the same visual flutter
// with the UV left untouched, so nothing can be cut. The shadow pass runs this same
// positionNode, so cast silhouettes stay in sync for free.
function billboardOffset(clusterScale: ReturnType<typeof instancedBufferAttribute>, wind: WindUniforms) {
    const flutter = windOffset(wind)(positionLocal.xz).length().mul(2.2)
    // center vec2(0): corner offsets are already relative to the quad centre
    const corner = rotateUV(attribute<'vec2'>('corner', 'vec2'), flutter, vec2(0)).mul(clusterScale)
    const right = cameraWorldMatrix.mul(vec4(1, 0, 0, 0)).xyz
    const up = cameraWorldMatrix.mul(vec4(0, 1, 0, 0)).xyz
    return right.mul(corner.x).add(up.mul(corner.y))
}

export function applyFoliageTexture(material: FoliageMaterial, tex: Texture, wind: WindUniforms, grading?: GradingContext | null) {
    // graded path skips opacityNode — alpha routes through the stylized finish instead
    if (!grading) material.opacityNode = texture(tex, uv()).r
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
    dropShadowNode?: ReturnType<typeof createDropShadowCatcher>['shadowFactor'],
) {
    const ramp = normalWorld.dot(grading.uniforms.lightDirection).smoothstep(0, 1)
    const baseColor = mix(colorAUniform, colorBUniform, ramp)
    const alpha = tex ? texture(tex, uv()).r : float(1)
    return stylizedOutput(baseColor, grading, {
        hasCoreShadows: true,
        // baked cluster-depth AO: inner leaves sink into the shadow band
        aoNode: varying(attribute<'float'>('ao', 'float')),
        dropShadowNode,
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
    instanceScale: InstancedBufferAttribute,
    windUniforms: WindUniforms,
    trample?: TrampleMap | null,
    grading?: GradingContext | null,
    dropShadow?: ReturnType<typeof createDropShadowCatcher> | null,
}) {
    const { colorAUniform, colorBUniform, lightingDirUniform, foliageTexture, instanceMatrix, instanceScale, windUniforms, trample, grading, dropShadow } = options
    // grading IS the lighting — Lambert base only exists so the drop-shadow catcher runs
    const material: FoliageMaterial = grading ? new MeshLambertNodeMaterial() : new MeshStandardNodeMaterial()

    // FrontSide, like Bruno's MeshDefaultMaterial default. The quads are billboarded to
    // face the camera, so a back face only ever appears on a quad turned away from the
    // viewer — rendering those double-sided just piles unlit, wrong-normal leaves into
    // the blob and flattens the shading.
    material.depthWrite = true
    material.transparent = false
    if (!grading) material.alphaTest = 0.3 // graded path discards inside the finish instead

    // Shadow pass MUST keep the front face. three flips a FrontSide material to
    // BackSide when filling the shadow map (_shadowSide in Renderer.js), which is
    // the right call for a closed solid — the depth lands on the far shell, away
    // from the surface being lit, so acne needs less bias. A billboard has no far
    // shell: positionNode below rebuilds the quad around whichever camera renders,
    // so in the shadow pass the leaf turns to face the LIGHT and its single front
    // face is the only one there is. Left on BackSide every quad is culled and the
    // canopy writes nothing at all — silently, because a shadow map still at its
    // cleared depth just reads as "everything is lit".
    material.shadowSide = FrontSide

    material.positionNode = Fn(() => {
        // three r184+ dropped the count argument and auto-stacks void Fn calls, so no
        // toStack(). @types/three 0.185 still declares the old signature, hence the cast.
        ;(instance as unknown as (matrices: InstancedBufferAttribute) => void)(instanceMatrix)
        // instance() assigns the transform to positionLocal at build time, AFTER any
        // statements authored here — so no toVar()/assign on it (a var would snapshot the
        // pre-instance value). A pure expression evaluates at the output, post-instance,
        // where xz is world space (instance matrices carry the world translation).
        const clusterScale = instancedBufferAttribute(instanceScale, 'float')
        // positionLocal is the leaf anchor; move the anchor first, then face the quad.
        let anchor = positionLocal
        if (trample) {
            const trampleAmt = texture(trample.texture, trampleUv(trample.uniforms, positionLocal.xz)).r
            // squash the cluster toward the ground (y=0: references sit at ground level) where trampled
            anchor = vec3(positionLocal.x, positionLocal.y.mul(trampleAmt.mul(0.6).oneMinus()), positionLocal.z)
        }
        return anchor.add(billboardOffset(clusterScale, windUniforms))
    })()

    if (grading) {
        if (dropShadow) {
            material.receivedShadowNode = dropShadow.receivedShadowNode
            // billboard planes self-shadow at grazing sun angles — sample the shadow
            // map 1 unit toward the light (world space: positionLocal would lose the
            // instance transform). lightDirection points INTO the scene, so subtract
            // material.receivedShadowPositionNode = positionWorld.sub(grading.uniforms.lightDirection)
        }
        material.outputNode = gradedFoliageOutput(grading, colorAUniform, colorBUniform, foliageTexture, windUniforms, dropShadow?.shadowFactor)
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
        trample,
        grading,
    } = options
    const rng = mulberry32(hashSeed(seed || ''))
    const geometry = buildClusterGeometry(rng, amount, size)
    const { matrices: instanceMatrix, scales: instanceScale } = buildInstanceMatrices(references, rng)

    // Pass raw Three.js objects to uniform() — NOT TSL nodes like color()/vec3()
    // Passing a TSL node as the uniform value causes zero-size GPU buffers
    const colorAUniform = uniform(new Color(colorA as Color))
    const colorBUniform = uniform(new Color(colorB as Color))
    const lightingDirUniform = uniform((lightingDirection ?? DEFAULT_LIGHTING_DIR).clone())
    const windUniforms = createWindUniforms(options)
    // shared across setTexture rebuilds — the catcher var must stay the one the
    // material's receivedShadowNode writes into
    const dropShadow = grading ? createDropShadowCatcher() : null

    const material = buildFoliageMaterial({
        colorAUniform,
        colorBUniform,
        lightingDirUniform,
        foliageTexture,
        instanceMatrix,
        instanceScale,
        windUniforms,
        trample,
        grading,
        dropShadow,
    })

    return {
        geometry,
        material,
        uniforms: { colorA: colorAUniform, colorB: colorBUniform, lightingDir: lightingDirUniform, wind: windUniforms },
        count: references.length,
        // texture can arrive after mount — rewire the alpha for whichever path is active
        setTexture: (tex: Texture) => {
            applyFoliageTexture(material, tex, windUniforms, grading)
            if (grading) material.outputNode = gradedFoliageOutput(grading, colorAUniform, colorBUniform, tex, windUniforms, dropShadow?.shadowFactor)
        },
        dispose: () => {
            geometry.dispose()
            material.dispose()
        },
    }
}
