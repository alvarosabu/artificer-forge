import { ClampToEdgeWrapping, LinearFilter, LinearMipmapLinearFilter, NoColorSpace, Texture, Vector2 } from 'three'
import { uniform } from 'three/tsl'
import type { Node, UniformNode } from 'three/webgpu'

export interface ControlMapSettings {
    /** the image holding the channels: r = road, g = grass, b = water */
    texture: Texture
    /** world extent the map covers, width = depth, in metres */
    size: number
    /** world XZ centre of that square */
    origin?: [number, number]
    /** texture anisotropy; the ground is mostly seen at grazing angles, so > 1 pays off */
    anisotropy?: number
}

export interface ControlMapUniforms {
    origin: UniformNode<'vec2', Vector2>
    size: UniformNode<'float', number>
}

export interface ControlMap {
    texture: Texture
    uniforms: ControlMapUniforms
    size: number
    origin: Vector2
}
export function createControlMap({ texture, size, origin = [0, 0], anisotropy = 4 }: ControlMapSettings): ControlMap {
    texture.colorSpace = NoColorSpace
    texture.flipY = false
    texture.wrapS = texture.wrapT = ClampToEdgeWrapping
    texture.magFilter = LinearFilter
    // mipmapped + anisotropic on purpose: unfiltered masks moire and crawl badly
    // at grazing angles. Distant mips blend the channels into mush, which fog
    // covers, and mush beats shimmer.
    texture.minFilter = LinearMipmapLinearFilter
    texture.generateMipmaps = true
    texture.anisotropy = anisotropy
    texture.needsUpdate = true

    return {
        texture,
        size,
        origin: new Vector2(origin[0], origin[1]),
        uniforms: {
          origin: uniform(new Vector2(origin[0], origin[1])),
          size: uniform(size),
        },
      }
}

// shader-side world XZ → map uv. The CPU reader in stage 7 repeats this exactly.
export function controlUv(uniforms: ControlMapUniforms, worldXZ: Node<'vec2'>) {
    return worldXZ.sub(uniforms.origin).div(uniforms.size).add(0.5)
}
/**
 * CPU-side reader for the same map, so scatter placement can be baked instead of
 * tested per instance in a vertex shader. Decoding is lazy and cached on the map,
 * because every vegetation species asks for the same pixels.
 */
export interface ControlMapPixels {
    data: Uint8ClampedArray
    width: number
    height: number
}

/** r = road, g = grass, b = water, matching the channel order of the image */
export const CONTROL_CHANNEL = { road: 0, grass: 1, water: 2 } as const

const pixelCache = new WeakMap<Texture, ControlMapPixels | null>()

function decode(image: unknown): ControlMapPixels | null {
    const source = image as { width?: number, height?: number } | null
    const width = source?.width ?? 0
    const height = source?.height ?? 0
    // useTexture hands back an image-less Texture until the file lands
    if (!width || !height) return null

    const canvas = typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(width, height)
        : typeof document !== 'undefined' ? document.createElement('canvas') : null
    if (!canvas) return null
    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext('2d', { willReadFrequently: true }) as
        (CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null)
    if (!ctx) return null

    ctx.drawImage(image as CanvasImageSource, 0, 0)
    return { data: ctx.getImageData(0, 0, width, height).data, width, height }
}

/**
 * Hand the reader pixels directly, skipping the canvas decode. For a control map
 * generated in memory (and for tests, where there is no canvas at all).
 */
export function setControlPixels(map: ControlMap, pixels: ControlMapPixels | null) {
    pixelCache.set(map.texture, pixels)
}

/** decoded pixels for this map, or null when the image cannot be read yet */
export function readControlPixels(map: ControlMap): ControlMapPixels | null {
    const cached = pixelCache.get(map.texture)
    if (cached !== undefined) return cached
    const pixels = decode(map.texture.image)
    // a null result is cached too, but only once the image is actually present:
    // caching a miss on an unloaded texture would stick forever
    if (pixels || map.texture.image) pixelCache.set(map.texture, pixels)
    return pixels
}

/**
 * Bilinear read of one channel at a world XZ, matching `controlUv` plus the
 * texture's LinearFilter. `flipY` is false on this map, so v = 0 is image row 0
 * and there is no flip here either. The map is NoColorSpace, so the raw byte
 * over 255 is the value the shader sees. Mip 0 on purpose: a vertex-stage
 * `texture()` has no derivatives, so the GPU samples the top level too.
 */
export function sampleControlChannel(
    map: ControlMap,
    pixels: ControlMapPixels,
    worldX: number,
    worldZ: number,
    channel: number,
): number {
    const { data, width, height } = pixels
    const u = (worldX - map.origin.x) / map.size + 0.5
    const v = (worldZ - map.origin.y) / map.size + 0.5

    // texel centres sit at half-texel offsets, the same place the sampler reads
    const fx = u * width - 0.5
    const fy = v * height - 0.5
    const x0 = Math.floor(fx)
    const y0 = Math.floor(fy)
    const tx = fx - x0
    const ty = fy - y0

    const at = (x: number, y: number) => {
        // ClampToEdgeWrapping
        const cx = x < 0 ? 0 : x > width - 1 ? width - 1 : x
        const cy = y < 0 ? 0 : y > height - 1 ? height - 1 : y
        return data[(cy * width + cx) * 4 + channel] / 255
    }

    const top = at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx
    const bottom = at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx
    return top * (1 - ty) + bottom * ty
}
