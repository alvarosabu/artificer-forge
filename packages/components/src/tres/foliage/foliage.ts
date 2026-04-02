import { TresColor } from "@tresjs/core"
import { BufferGeometry, Color, DoubleSide, Object3D, PlaneGeometry, Quaternion, Spherical, Texture, Vector3 } from "three"
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js"
import { color, float, Fn, mix, normalWorld, positionViewDirection, rotateUV, texture, uniform, uv, vec2 } from "three/tsl"
import { MeshStandardNodeMaterial } from "three/webgpu"

export interface FoliageOptions {
    references: Object3D[]
    colorA: TresColor 
    colorB: TresColor   
    seed?: string
    foliageTexture?: Texture | null
}

const PLANE_COUNT = 80
const PLANE_SIZE = 0.8

// Deterministic seeded RNG — no external dependency
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

function buildClusterGeometry(rng: () => number): BufferGeometry {
    const planes: BufferGeometry[] = []
    const spherical = new Spherical()
    const normal = new Vector3()
    const surfaceNormal = new Vector3()

    for (let i = 0; i < PLANE_COUNT; i++) {
        const plane = new PlaneGeometry(PLANE_SIZE, PLANE_SIZE)

        // Position on sphere surface, biased toward surface with pow3
        spherical.set(
            1 - Math.pow(rng(), 3),          // radius biased toward 1
            Math.acos(2 * rng() - 1),        // polar angle (full sphere)
            rng() * Math.PI * 2,             // azimuth
        )
        const position = new Vector3().setFromSpherical(spherical)

        // Random spin, then orient plane to face outward from sphere center
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

            // Surface normal at this vertex = direction from origin to vertex position
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

function buildFoliageMaterial(colorA: TresColor, colorB: TresColor, foliageTexture?: Texture | null) {
    const colorAUniform = uniform(color(new Color(colorA as Color)))
    const colorBUniform = uniform(color(new Color(colorB as Color)))

    const threshold = uniform(0.3)

    const material = new MeshStandardNodeMaterial()
    material.side = DoubleSide
    material.depthWrite = true
    material.transparent = false
    material.alphaTest = threshold.value
    material.colorNode = Fn(() => {
        const mixStrength = normalWorld.dot(positionViewDirection).smoothstep(0, 1)
        return mix(colorAUniform, colorBUniform, mixStrength)
    })()

    if (foliageTexture) {
        material.opacityNode = texture(foliageTexture, uv()).r
    }

    return material
}

export function createFoliage(options: FoliageOptions) {
    const { references: _references, colorA, colorB, seed, foliageTexture } = options
    const rng = mulberry32(hashSeed(seed || ''))
    const geometry = buildClusterGeometry(rng)
    const material = buildFoliageMaterial(colorA, colorB, foliageTexture)
    return { geometry, material }
}