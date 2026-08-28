import { ClampToEdgeWrapping, LinearFilter, NearestFilter, NoColorSpace, Vector2 } from 'three'
import type { Ray, Texture, Vector3 } from 'three'
import { uniform } from 'three/tsl'
import type { HeightEncoding, HeightField } from './heightField'

/** sidecar json written by scripts/bake-heightmap.mjs; maps the PNG's 0..1 back to world metres */
export interface HeightMapMeta {
  /** texels per side */
  resolution: number
  size: number
  /** world XZ centre, not corner */
  origin: [number, number]
  minHeight: number
  maxHeight: number
  texelSize?: number
  flipY?: boolean
  /** `grey` is a tenth of the size; switch to `rgb` once (maxHeight - minHeight) / 255 is a visible step */
  encoding?: HeightEncoding
}

export interface HeightMapSettings {
  texture: Texture
  meta: HeightMapMeta
}

// The PNG is the source and the mesh is generated from it (createTerrainQuadtree).
// `bake` is a no-op so this stays interchangeable with createHeightField.
export function createHeightMap({ texture, meta }: HeightMapSettings): HeightField {
  const encoding: HeightEncoding = meta.encoding ?? 'grey'

  // sRGB decoding would bend the height ramp into a curve
  texture.colorSpace = NoColorSpace
  // if the level comes out mirrored along Z, this is the flag to flip
  texture.flipY = meta.flipY ?? false
  texture.wrapS = texture.wrapT = ClampToEdgeWrapping
  // NEAREST is mandatory on rgb: filtering would blend the packed bytes;
  // sampleHeight() blends after decoding instead
  const filter = encoding === 'rgb' ? NearestFilter : LinearFilter
  texture.minFilter = filter
  texture.magFilter = filter
  // a vertex-stage fetch has no derivatives to pick a mip, and a lower mip would flatten hills
  texture.generateMipmaps = false
  texture.needsUpdate = true

  const heightRange = meta.maxHeight - meta.minHeight
  const texelSize = meta.texelSize ?? meta.size / meta.resolution

  return {
    texture,
    encoding,
    size: meta.size,
    origin: new Vector2(meta.origin[0], meta.origin[1]),
    minHeight: meta.minHeight,
    heightRange,
    resolution: meta.resolution,
    uniforms: {
      origin: uniform(new Vector2(meta.origin[0], meta.origin[1])),
      size: uniform(meta.size),
      texelSize: uniform(texelSize),
      minHeight: uniform(meta.minHeight),
      heightRange: uniform(heightRange),
    },
    bake: async () => {},
    // the texture is owned by the loader (useTexture caches by url); disposing it
    // here breaks the next mount
    dispose: () => {},
  }
}

export interface HeightPixels {
  data: Uint8ClampedArray
  width: number
  height: number
}

const pixelCache = new WeakMap<Texture, HeightPixels | null>()

function decode(image: unknown): HeightPixels | null {
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

/** for tests: bypass the canvas decode */
export function setHeightPixels(field: HeightField, pixels: HeightPixels | null) {
  pixelCache.set(field.texture, pixels)
}

export function readHeightPixels(field: HeightField): HeightPixels | null {
  const cached = pixelCache.get(field.texture)
  if (cached !== undefined) return cached
  const pixels = decode(field.texture.image)
  // only cache a miss once the image exists, or an unloaded texture sticks as null forever
  if (pixels || field.texture.image) pixelCache.set(field.texture, pixels)
  return pixels
}

// Must match heightUv() plus LinearFilter exactly, or CPU picks land off the drawn surface.
export function sampleHeightAt(field: HeightField, pixels: HeightPixels, worldX: number, worldZ: number): number {
  const { data, width, height } = pixels
  const u = (worldX - field.origin.x) / field.size + 0.5
  const v = (worldZ - field.origin.y) / field.size + 0.5

  // texel centres sit at half-texel offsets, the same place the sampler reads
  const fx = u * width - 0.5
  const fy = v * height - 0.5
  const x0 = Math.floor(fx)
  const y0 = Math.floor(fy)
  const tx = fx - x0
  const ty = fy - y0

  const packed = field.encoding === 'rgb'
  const at = (x: number, y: number) => {
    // ClampToEdgeWrapping
    const cx = x < 0 ? 0 : x > width - 1 ? width - 1 : x
    const cy = y < 0 ? 0 : y > height - 1 ? height - 1 : y
    const i = (cy * width + cx) * 4
    // decode before blending, as the shader does
    return packed
      ? (data[i] * 65536 + data[i + 1] * 256 + data[i + 2]) / 16777215
      : data[i] / 255
  }

  const top = at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx
  const bottom = at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx
  return field.minHeight + (top * (1 - ty) + bottom * ty) * field.heightRange
}

// March then bisect: the field is bilinear patches, so there is no closed-form solve.
// One texel per step means no feature the map holds can be stepped over.
export function intersectHeightField(
  field: HeightField,
  pixels: HeightPixels,
  ray: Ray,
  target: Vector3,
  maxDistance = field.size * 3,
): boolean {
  const step = Math.max(field.size / field.resolution, 0.05)
  const dir = ray.direction
  // a near-horizontal ray is not a ground pick and would need thousands of steps
  if (Math.abs(dir.y) < 1e-4) return false

  let t = 0
  let previousT = 0
  let previousGap = 0
  let first = true

  while (t <= maxDistance) {
    const x = ray.origin.x + dir.x * t
    const y = ray.origin.y + dir.y * t
    const z = ray.origin.z + dir.z * t
    const gap = y - sampleHeightAt(field, pixels, x, z)

    if (!first && gap <= 0 && previousGap > 0) {
      let lo = previousT
      let hi = t
      for (let i = 0; i < 12; i++) {
        const mid = (lo + hi) * 0.5
        const mx = ray.origin.x + dir.x * mid
        const my = ray.origin.y + dir.y * mid
        const mz = ray.origin.z + dir.z * mid
        if (my - sampleHeightAt(field, pixels, mx, mz) > 0) lo = mid
        else hi = mid
      }
      const hit = (lo + hi) * 0.5
      target.set(ray.origin.x + dir.x * hit, ray.origin.y + dir.y * hit, ray.origin.z + dir.z * hit)
      return true
    }
    // starting underground (camera below a ridge) is still a valid pick
    if (first && gap <= 0) {
      target.set(x, y, z)
      return true
    }

    first = false
    previousT = t
    previousGap = gap
    t += step
  }
  return false
}
