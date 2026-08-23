import { ClampToEdgeWrapping, LinearFilter, NearestFilter, NoColorSpace, Vector2 } from 'three'
import type { Ray, Texture, Vector3 } from 'three'
import { uniform } from 'three/tsl'
import type { HeightEncoding, HeightField } from './heightField'

/**
 * The sidecar json a baked height PNG ships with. Written by the Blender export,
 * and the only thing that ties the image's 0..1 back to world metres — without it
 * the PNG is a grey square with no scale.
 */
export interface HeightMapMeta {
  /** texels per side */
  resolution: number
  /** world extent the map covers, width = depth, in metres */
  size: number
  /** world XZ centre of that square */
  origin: [number, number]
  /** world Y that an encoded 0 stands for */
  minHeight: number
  /** world Y that an encoded 1 stands for */
  maxHeight: number
  /** metres per texel; recomputed from size/resolution if absent */
  texelSize?: number
  /** how the exporter laid out the rows; false means image row 0 is v = 0 */
  flipY?: boolean
  /**
   * Which of the two PNGs the baker wrote you are loading. `grey` is the default
   * because it is a tenth of the size; switch to `rgb` once
   * (maxHeight - minHeight) / 255 is a step you can see — around 138 m of relief
   * that is half a metre.
   */
  encoding?: HeightEncoding
}

export interface HeightMapSettings {
  /** the loaded greyscale image; height comes from the red channel */
  texture: Texture
  meta: HeightMapMeta
}

/**
 * Turns a baked height PNG into the same HeightField every other system already
 * consumes. This inverts the old dependency: instead of baking a height texture
 * out of a terrain mesh, the texture is the source and the mesh is generated from
 * it (see createTerrainQuadtree).
 *
 * `bake` is a no-op so the two constructors stay interchangeable at the call site.
 */
export function createHeightMap({ texture, meta }: HeightMapSettings): HeightField {
  const encoding: HeightEncoding = meta.encoding ?? 'grey'

  // raw numbers, not colour. sRGB decoding would bend the height ramp into a
  // curve, which reads as a terrain that sags in the middle of its range.
  texture.colorSpace = NoColorSpace
  // the exporter records its own row order; the json for testbed says false, and
  // if the level comes out mirrored along Z this is the one flag to flip
  texture.flipY = meta.flipY ?? false
  texture.wrapS = texture.wrapT = ClampToEdgeWrapping
  // Linear on grey, so a vertex lands between texels smoothly instead of on a
  // staircase of quads. NEAREST is mandatory on rgb: filtering would average the
  // packed bytes and decode to a height from nowhere. sampleHeight() does the
  // blending itself in that case.
  const filter = encoding === 'rgb' ? NearestFilter : LinearFilter
  texture.minFilter = filter
  texture.magFilter = filter
  // Mipmaps off either way: a vertex-stage fetch has no derivatives to pick a
  // level with, and a lower mip would flatten hills at exactly the distance the
  // quadtree is already coarsening them.
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
    // nothing to render: the pixels arrived with the file
    bake: async () => {},
    // the texture is owned by whoever loaded it (useTexture caches by url), so
    // disposing it here would break the next mount
    dispose: () => {},
  }
}

// --- CPU side ---

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

/** Hand the reader pixels directly, skipping the canvas decode. For tests. */
export function setHeightPixels(field: HeightField, pixels: HeightPixels | null) {
  pixelCache.set(field.texture, pixels)
}

/** decoded pixels for this field, or null while the image is still loading */
export function readHeightPixels(field: HeightField): HeightPixels | null {
  const cached = pixelCache.get(field.texture)
  if (cached !== undefined) return cached
  const pixels = decode(field.texture.image)
  // a null result is cached too, but only once the image is actually present:
  // caching a miss on an unloaded texture would stick forever
  if (pixels || field.texture.image) pixelCache.set(field.texture, pixels)
  return pixels
}

/**
 * Bilinear read of the height under a world XZ, in metres. Mirrors heightUv() plus
 * the texture's LinearFilter exactly, so the ground the CPU reports and the ground
 * the GPU draws are the same surface — a click that lands 20 cm off the visible
 * terrain is this function disagreeing with the shader.
 */
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
    // decode BEFORE blending, for the same reason the shader does: averaging a
    // high byte with a neighbour's low byte is meaningless
    return packed
      ? (data[i] * 65536 + data[i + 1] * 256 + data[i + 2]) / 16777215
      : data[i] / 255
  }

  const top = at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx
  const bottom = at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx
  return field.minHeight + (top * (1 - ty) + bottom * ty) * field.heightRange
}

/**
 * Where a ray meets the height field, written into `target`. Returns false on a miss.
 *
 * A march, not an analytic solve: the field is a bilinear patchwork, so there is no
 * closed form. Step along the ray until the sample flips from above-surface to
 * below, then bisect that one interval. The step is a texel, so no feature narrower
 * than the map itself can be stepped over; the bisection is what gets the hit from
 * texel-accurate to centimetre-accurate.
 */
export function intersectHeightField(
  field: HeightField,
  pixels: HeightPixels,
  ray: Ray,
  target: Vector3,
  maxDistance = field.size * 3,
): boolean {
  // one texel per step: no feature the map can describe fits between two samples
  const step = Math.max(field.size / field.resolution, 0.05)
  const dir = ray.direction
  // a ray running exactly along the ground plane would need thousands of steps to
  // get nowhere useful; anything near-horizontal is not a ground pick
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
      // the crossing is inside [previousT, t]; bisect it
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
    // starting underground is a legitimate pick (the camera dipped below a ridge),
    // so take the very first sample as the hit rather than marching to nothing
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
