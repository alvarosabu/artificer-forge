import { Mesh } from 'three'
import {
    ClampToEdgeWrapping, HalfFloatType, LinearFilter, MeshBasicNodeMaterial,
    NoColorSpace, NoToneMapping, OrthographicCamera, RGBAFormat, RenderTarget,
    Scene, Vector2,
} from 'three/webgpu'
import type { BufferGeometry, Node, Texture, UniformNode, WebGPURenderer } from 'three/webgpu'
import { floor, mix, positionWorld, texture, uniform, vec2, vec4 } from 'three/tsl'

export interface HeightFieldSettings {
    /** the ground mesh geometry, with its node transform already baked in */
    geometry: BufferGeometry
    /** world extent the field covers, width = depth, in metres */
    size: number
    /** world XZ centre of that square */
    origin?: [number, number]
    /** texels per side; 512 over 60 metres is about 12 centimetres per texel */
    resolution?: number
}

export interface HeightFieldUniforms {
    origin: UniformNode<'vec2', Vector2>
    size: UniformNode<'float', number>
    /** world metres covered by one texel; stage 7 uses it as a sampling step */
    texelSize: UniformNode<'float', number>
    /** world Y that an encoded 0 stands for */
    minHeight: UniformNode<'float', number>
    /** world Y span that the encoded 0..1 covers */
    heightRange: UniformNode<'float', number>
}

/**
 * How the image stores its 0..1.
 *
 * `grey` is the red channel, so 8 bits: fine while (maxHeight - minHeight) / 255
 * is smaller than the terracing you can see. `rgb` packs 24 bits across r/g/b,
 * which costs four texture reads and a manual bilinear (see sampleHeight) because
 * a hardware-filtered tap would blend the BYTES and decode to nonsense.
 */
export type HeightEncoding = 'grey' | 'rgb'

export interface HeightField {
    texture: Texture
    encoding: HeightEncoding
    uniforms: HeightFieldUniforms
    /**
     * The same numbers as the uniforms, in plain JS. A CPU reader cannot get at a
     * UniformNode's value without reaching through `.value`, and the quadtree needs
     * these every frame — so they are mirrored here rather than dug out each time.
     */
    size: number
    origin: Vector2
    minHeight: number
    heightRange: number
    resolution: number
    bake: (renderer: WebGPURenderer) => Promise<void>
    dispose: () => void
}

// No v flip, and that is WebGPU-specific. Its framebuffer origin is top-left, so
// NDC y = +1 is the FIRST texture row (v = 0). The bake camera's up is (0, 0, -1),
// which puts world +z at NDC y = -1, so world +z lands at v = 1 — the same way
// round as controlUv(). On a WebGL target this would need `local.y.oneMinus()`.
export function heightUv(uniforms: HeightFieldUniforms, worldXZ: Node<'vec2'>) {
    const local = worldXZ.sub(uniforms.origin).div(uniforms.size).add(0.5)
    return vec2(local.x, local.y)
}

// 24 bits big-endian across r/g/b, matching the sidecar json's documented unpack.
// texture() hands back byte/255, so the 255 puts the bytes back.
const unpackRgb = (colour: Node<'vec4'>) =>
    colour.r.mul(65536).add(colour.g.mul(256)).add(colour.b).mul(255 / 16777215)

/**
 * Bilinear blend of four NEAREST taps.
 *
 * A packed height map MUST be sampled unfiltered — hardware filtering would
 * average the r, g and b bytes independently, and averaging the high byte of one
 * texel with the low byte of its neighbour decodes to a height from nowhere. So
 * the four corners are fetched at their exact centres and blended after decoding,
 * which is the same result the sampler would give if the value were a single float.
 */
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

/**
 * World Y of the field under a world XZ.
 *
 * The image holds a normalised 0..1, so it has to be decoded back into metres.
 * A GPU-baked field stores metres directly and sets minHeight 0 / heightRange 1,
 * which makes this a no-op for it; a loaded PNG carries the real range from its
 * sidecar json. Both paths then read the same, so every consumer (grass, flowers,
 * props, the quadtree mesh) is indifferent to where the field came from.
 */
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
    // raw numbers, not colour: any colour space conversion would corrupt the metres
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
    // near 0, far the full height range: the camera sits at `top` looking down, so
    // the frustum has to be deep enough to reach the lowest triangle
    const camera = new OrthographicCamera(-half, half, half, -half, 0, top - bottom)
    // looking straight down is degenerate with the default up vector of (0, 1, 0),
    // so pick an up vector that lies in the ground plane
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
        // a half-float target already holds the metres; nothing is packed
        encoding: 'grey' as const,
        size,
        origin: new Vector2(origin[0], origin[1]),
        // the bake writes positionWorld.y straight into a half-float target, so the
        // stored value IS the metre count and needs no decoding
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