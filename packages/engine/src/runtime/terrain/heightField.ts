import { Mesh } from 'three'
import {
    ClampToEdgeWrapping, HalfFloatType, LinearFilter, MeshBasicNodeMaterial,
    NoColorSpace, NoToneMapping, OrthographicCamera, RGBAFormat, RenderTarget,
    Scene, Vector2,
} from 'three/webgpu'
import type { BufferGeometry, Node, Texture, UniformNode, WebGPURenderer } from 'three/webgpu'
import { floor, mix, positionWorld, texture, uniform, vec2, vec4 } from 'three/tsl'

export interface HeightFieldSettings {
    /** world-space geometry; the bake does not apply a node transform */
    geometry: BufferGeometry
    size: number
    /** world XZ centre, not corner */
    origin?: [number, number]
    /** texels per side */
    resolution?: number
}

export interface HeightFieldUniforms {
    origin: UniformNode<'vec2', Vector2>
    size: UniformNode<'float', number>
    texelSize: UniformNode<'float', number>
    minHeight: UniformNode<'float', number>
    heightRange: UniformNode<'float', number>
}

// `grey`: 8 bits in the red channel. `rgb`: 24 bits packed across r/g/b, which
// needs NEAREST plus a manual bilinear (see sampleHeight).
export type HeightEncoding = 'grey' | 'rgb'

export interface HeightField {
    texture: Texture
    encoding: HeightEncoding
    uniforms: HeightFieldUniforms
    /** plain-JS mirror of the uniforms, read every frame by the CPU side */
    size: number
    origin: Vector2
    minHeight: number
    heightRange: number
    resolution: number
    bake: (renderer: WebGPURenderer) => Promise<void>
    dispose: () => void
}

// No v flip: WebGPU's framebuffer origin is top-left, so the bake lands world +z at
// v = 1, same as controlUv(). A WebGL target would need `local.y.oneMinus()`.
export function heightUv(uniforms: HeightFieldUniforms, worldXZ: Node<'vec2'>) {
    const local = worldXZ.sub(uniforms.origin).div(uniforms.size).add(0.5)
    return vec2(local.x, local.y)
}

// must match the pack in scripts/bake-heightmap.mjs; texture() returns byte/255, the 255 undoes it
const unpackRgb = (colour: Node<'vec4'>) =>
    colour.r.mul(65536).add(colour.g.mul(256)).add(colour.b).mul(255 / 16777215)

// Four NEAREST taps blended after decoding: hardware filtering would average the
// packed bytes and decode to nonsense.
function bilinearRgb(field: HeightField, uv: Node<'vec2'>) {
    const resolution = field.resolution
    const texel = 1 / resolution
    // texel centres sit at half-texel offsets; land off by half and every slope shifts
    const p = uv.mul(resolution).sub(0.5).toVar()
    const corner = floor(p).toVar()
    const f = p.sub(corner).toVar()
    const base = corner.add(0.5).mul(texel).toVar()

    const at = (du: number, dv: number) =>
        unpackRgb(texture(field.texture, base.add(vec2(du * texel, dv * texel))))

    const top = mix(at(0, 0), at(1, 0), f.x)
    const bottom = mix(at(0, 1), at(1, 1), f.x)
    return mix(top, bottom, f.y)
}

// A GPU-baked field stores metres (minHeight 0, heightRange 1); a loaded PNG carries
// its range from the sidecar json. Both decode the same way here.
export function sampleHeight(field: HeightField, worldXZ: Node<'vec2'>) {
    const uv = heightUv(field.uniforms, worldXZ)
    const normalised = field.encoding === 'rgb'
        ? bilinearRgb(field, uv)
        : texture(field.texture, uv).r
    return normalised.mul(field.uniforms.heightRange).add(field.uniforms.minHeight)
}

export function createHeightField({
    geometry, size, origin = [0, 0], resolution = 512,
}: HeightFieldSettings): HeightField {
    const target = new RenderTarget(resolution, resolution, {
        type: HalfFloatType,
        format: RGBAFormat,
        depthBuffer: true,
        generateMipmaps: false,
    })
    // any colour space conversion would corrupt the metres
    target.texture.colorSpace = NoColorSpace
    target.texture.minFilter = LinearFilter
    target.texture.magFilter = LinearFilter
    target.texture.wrapS = target.texture.wrapT = ClampToEdgeWrapping

    const material = new MeshBasicNodeMaterial()
    material.outputNode = vec4(positionWorld.y, 0, 0, 1)

    const bakeScene = new Scene()
    bakeScene.add(new Mesh(geometry, material))

    geometry.computeBoundingBox()
    const box = geometry.boundingBox!
    // one metre of slack at each end, so no triangle sits exactly on a clip plane
    const top = box.max.y + 1
    const bottom = box.min.y - 1

    const half = size / 2
    // the frustum must reach from `top` down to the lowest triangle
    const camera = new OrthographicCamera(-half, half, half, -half, 0, top - bottom)
    // looking straight down is degenerate with the default up vector (0, 1, 0)
    camera.up.set(0, 0, -1)
    camera.position.set(origin[0], top, origin[1])
    camera.lookAt(origin[0], bottom, origin[1])

    async function bake(renderer: WebGPURenderer) {
        const previousTarget = renderer.getRenderTarget()
        const previousToneMapping = renderer.toneMapping
        // tone mapping would curve the metres into a display range
        renderer.toneMapping = NoToneMapping
        renderer.setRenderTarget(target)
        await renderer.render(bakeScene, camera)
        renderer.setRenderTarget(previousTarget)
        renderer.toneMapping = previousToneMapping
    }

    return {
        texture: target.texture,
        encoding: 'grey' as const,
        size,
        origin: new Vector2(origin[0], origin[1]),
        // the half-float target holds metres directly, so no decoding
        minHeight: 0,
        heightRange: 1,
        resolution,
        uniforms: {
            origin: uniform(new Vector2(origin[0], origin[1])),
            size: uniform(size),
            texelSize: uniform(size / resolution),
            minHeight: uniform(0),
            heightRange: uniform(1),
        },
        bake,
        dispose: () => {
            target.dispose()
            material.dispose()
        },
    }
}