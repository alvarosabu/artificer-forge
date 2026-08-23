/**
 * Bakes a terrain mesh out of a level GLB into a height map PNG plus the sidecar
 * json that gives it a scale.
 *
 * This is the build-time half of the runtime terrain: createHeightMap() reads the
 * PNG and TerrainQuadtree generates the surface from it, so the mesh in the GLB
 * stops being shipped geometry and becomes an authoring source. Re-run this
 * whenever the terrain is re-exported from Blender.
 *
 * Usage:
 *   node scripts/bake-heightmap.mjs <glb> [--node Terrain] [--resolution 2048]
 *                                        [--size 512] [--origin x,z]
 *                                        [--name stem] [--out dir]
 *
 * The window is SQUARE, because heightUv() divides by one `size` on both axes. By
 * default it is the mesh's bounding square, so nothing is cropped and a non-square
 * level gets padded. Pass --size and --origin to bake a chosen window instead —
 * that is how you crop a big level down to its playable region.
 *
 * Writes, next to the GLB by default:
 *   <name>.height-<res>.png       8-bit grey, the map the runtime loads
 *   <name>.height-<res>.rgb.png   24-bit packed, same data, for when 8 bits terrace
 *   <name>.height-<res>.json      size / origin / min / max — the scale
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import process from 'node:process'
import { NodeIO } from '@gltf-transform/core'
import { KHRONOS_EXTENSIONS } from '@gltf-transform/extensions'
import draco3d from 'draco3dgltf'
import sharp from 'sharp'

// --- args ---

const argv = process.argv.slice(2)
if (!argv.length || argv[0].startsWith('--')) {
  console.error('usage: node scripts/bake-heightmap.mjs <glb> [--node Terrain] [--resolution 2048] [--out dir]')
  process.exit(1)
}
const glbPath = argv[0]
function flag(name, fallback) {
  const at = argv.indexOf(`--${name}`)
  return at === -1 ? fallback : argv[at + 1]
}
const nodeName = flag('node', 'Terrain')
const resolution = Number(flag('resolution', 2048))
const outDir = flag('out', dirname(glbPath))
const sizeOverride = flag('size') ? Number(flag('size')) : null
const originOverride = flag('origin') ? flag('origin').split(',').map(Number) : null
// a cropped bake needs its own name, or it overwrites the full-extent one
const nameOverride = flag('name')

// --- read the GLB ---

const io = new NodeIO()
  .registerExtensions(KHRONOS_EXTENSIONS)
  .registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(),
  })

const document = await io.read(glbPath)
const root = document.getRoot()

// The terrain is found by NODE name, the same contract the runtime uses. A rename
// in Blender has to fail loudly here rather than silently baking a rock.
const terrainNodes = root.listNodes().filter(node => node.getName() === nodeName)
if (!terrainNodes.length) {
  const names = root.listNodes().map(n => n.getName()).join(', ')
  console.error(`no node named "${nodeName}" in ${basename(glbPath)}. Nodes: ${names}`)
  process.exit(1)
}

/** world-space triangle soup of every primitive under the named node(s) */
function collectTriangles() {
  const triangles = []

  for (const node of terrainNodes) {
    const mesh = node.getMesh()
    if (!mesh) continue
    const m = node.getWorldMatrix()

    for (const primitive of mesh.listPrimitives()) {
      const position = primitive.getAttribute('POSITION')
      if (!position) continue
      const index = primitive.getIndices()
      const count = index ? index.getCount() : position.getCount()
      const vertex = [0, 0, 0]
      const world = new Float64Array(count * 3)

      for (let i = 0; i < count; i++) {
        position.getElement(index ? index.getScalar(i) : i, vertex)
        const [x, y, z] = vertex
        // column-major mat4, glTF convention
        const w = m[3] * x + m[7] * y + m[11] * z + m[15] || 1
        world[i * 3] = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w
        world[i * 3 + 1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w
        world[i * 3 + 2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w
      }

      for (let i = 0; i + 2 < count; i += 3) triangles.push(world.subarray(i * 3, i * 3 + 9))
    }
  }
  return triangles
}

const triangles = collectTriangles()
if (!triangles.length) {
  console.error(`node "${nodeName}" carries no triangles`)
  process.exit(1)
}

// --- bounds ---

let minX = Infinity, maxX = -Infinity
let minY = Infinity
let maxY = -Infinity
let minZ = Infinity, maxZ = -Infinity
for (const t of triangles) {
  for (let v = 0; v < 3; v++) {
    const x = t[v * 3], y = t[v * 3 + 1], z = t[v * 3 + 2]
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
    if (z < minZ) minZ = z
    if (z > maxZ) maxZ = z
  }
}

// A SQUARE window, because heightUv() divides by one `size` on both axes. The
// larger extent wins so nothing is cropped; the origin is the middle of the real
// bounds, which is not the world origin unless the mesh was centred in Blender.
// A non-square level therefore pads — --size/--origin crop instead.
const size = sizeOverride ?? Math.max(maxX - minX, maxZ - minZ)
const origin = originOverride ?? [(minX + maxX) / 2, (minZ + maxZ) / 2]
const halfSize = size / 2

// --- rasterise ---

// Highest surface per texel, which is what a top-down ortho bake with a depth
// test produces: for overhangs and for the seam where two shells meet, the roof
// wins. Terrain the character walks on is the top surface.
const height = new Float64Array(resolution * resolution).fill(Number.NEGATIVE_INFINITY)

// texel centre -> world, the exact inverse of heightUv() plus the sampler's
// half-texel offset. Get this wrong by half a texel and every slope shifts.
const texelSize = size / resolution
const worldAt = i => origin[0] - halfSize + (i + 0.5) * texelSize
const worldAtZ = j => origin[1] - halfSize + (j + 0.5) * texelSize

for (const t of triangles) {
  const [ax, ay, az, bx, by, bz, cx, cy, cz] = t

  // barycentric setup in the XZ plane; a triangle seen edge-on from above has
  // zero area there and covers no texel
  const area = (bx - ax) * (cz - az) - (cx - ax) * (bz - az)
  if (Math.abs(area) < 1e-12) continue
  const inverseArea = 1 / area

  const i0 = Math.max(0, Math.floor((Math.min(ax, bx, cx) - (origin[0] - halfSize)) / texelSize - 0.5))
  const i1 = Math.min(resolution - 1, Math.ceil((Math.max(ax, bx, cx) - (origin[0] - halfSize)) / texelSize - 0.5))
  const j0 = Math.max(0, Math.floor((Math.min(az, bz, cz) - (origin[1] - halfSize)) / texelSize - 0.5))
  const j1 = Math.min(resolution - 1, Math.ceil((Math.max(az, bz, cz) - (origin[1] - halfSize)) / texelSize - 0.5))

  for (let j = j0; j <= j1; j++) {
    const pz = worldAtZ(j)
    const rowStart = j * resolution
    for (let i = i0; i <= i1; i++) {
      const px = worldAt(i)
      const w0 = ((bx - px) * (cz - pz) - (cx - px) * (bz - pz)) * inverseArea
      const w1 = ((cx - px) * (az - pz) - (ax - px) * (cz - pz)) * inverseArea
      const w2 = 1 - w0 - w1
      // a hair of slack, so a texel centre sitting exactly on a shared edge is
      // claimed by one of the two triangles rather than by neither
      if (w0 < -1e-9 || w1 < -1e-9 || w2 < -1e-9) continue
      const y = w0 * ay + w1 * by + w2 * cy
      const at = rowStart + i
      if (y > height[at]) height[at] = y
    }
  }
}

// The height range has to come from what actually landed in the WINDOW. Using the
// whole mesh's range would spend most of the 8-bit ladder on terrain that was
// cropped away, which is the difference between 5 cm and 50 cm steps.
if (sizeOverride || originOverride) {
  let windowMin = Infinity
  let windowMax = -Infinity
  for (const value of height) {
    if (value === Number.NEGATIVE_INFINITY) continue
    if (value < windowMin) windowMin = value
    if (value > windowMax) windowMax = value
  }
  if (windowMin !== Infinity) {
    minY = windowMin
    maxY = windowMax
  }
}

// --- fill the texels no triangle claimed ---

// A non-square level pads, so this can be half the map. Fill it the way the
// sampler itself would: ClampToEdge outward, linear across an interior gap. Two
// O(n) sweeps, rows then columns — the obvious iterative flood is O(n x resolution)
// and takes billions of steps on a half-empty 2048 map.
let empty = 0
for (let i = 0; i < height.length; i++) if (height[i] === Number.NEGATIVE_INFINITY) empty++

if (empty) {
  const EMPTY = Number.NEGATIVE_INFINITY

  // one line of the grid, gaps closed in place. `stride` walks a row or a column.
  const fillLine = (start, stride, count) => {
    let previous = -1
    let any = false
    for (let n = 0; n < count; n++) {
      const at = start + n * stride
      if (height[at] === EMPTY) continue
      any = true
      if (previous === -1) {
        // leading gap: clamp to the first known value
        for (let k = 0; k < n; k++) height[start + k * stride] = height[at]
      }
      else if (n - previous > 1) {
        // interior gap: ramp between the two known ends
        const a = height[start + previous * stride]
        const b = height[at]
        const span = n - previous
        for (let k = previous + 1; k < n; k++) {
          height[start + k * stride] = a + (b - a) * ((k - previous) / span)
        }
      }
      previous = n
    }
    // trailing gap
    if (any && previous < count - 1) {
      const last = height[start + previous * stride]
      for (let k = previous + 1; k < count; k++) height[start + k * stride] = last
    }
    return any
  }

  const emptyRows = []
  for (let j = 0; j < resolution; j++) {
    if (!fillLine(j * resolution, 1, resolution)) emptyRows.push(j)
  }
  // rows that held nothing at all get their values down the columns instead
  if (emptyRows.length) {
    for (let i = 0; i < resolution; i++) fillLine(i, resolution, resolution)
  }
  // a fully empty map is the only way to reach here
  for (let i = 0; i < height.length; i++) {
    if (height[i] === EMPTY) height[i] = minY
  }
}

// --- encode ---

const range = maxY - minY || 1
const grey = Buffer.alloc(resolution * resolution * 3)
const packed = Buffer.alloc(resolution * resolution * 3)

for (let i = 0; i < height.length; i++) {
  const t = Math.min(Math.max((height[i] - minY) / range, 0), 1)

  const byte = Math.round(t * 255)
  grey[i * 3] = byte
  grey[i * 3 + 1] = byte
  grey[i * 3 + 2] = byte

  // 24-bit big-endian across r/g/b, matching the json's documented unpack:
  // (r * 65536 + g * 256 + b) / 16777215
  const value = Math.round(t * 16777215)
  packed[i * 3] = (value >> 16) & 0xFF
  packed[i * 3 + 1] = (value >> 8) & 0xFF
  packed[i * 3 + 2] = value & 0xFF
}

const stem = nameOverride ?? basename(glbPath).replace(/\.glb$/i, '')
const base = join(outDir, `${stem}.height-${resolution}`)
const pngOptions = { width: resolution, height: resolution, channels: 3 }

// compressionLevel 9 and no dithering: this is data, and a dithered height map
// reads as noise in the vertex shader
await sharp(grey, { raw: pngOptions }).png({ compressionLevel: 9, palette: false }).toFile(`${base}.png`)
await sharp(packed, { raw: pngOptions }).png({ compressionLevel: 9, palette: false }).toFile(`${base}.rgb.png`)

const round = (n, places = 4) => Number(n.toFixed(places))
const meta = {
  source: basename(glbPath),
  node: nodeName,
  resolution,
  size: round(size),
  origin: [round(origin[0]), round(origin[1])],
  minHeight: round(minY),
  maxHeight: round(maxY),
  texelSize: round(texelSize),
  flipY: false,
  encoding: {
    grey: 'r / 255 -> 0..1; height = minHeight + t * (maxHeight - minHeight)',
    rgb: '(r * 65536 + g * 256 + b) / 16777215 -> 0..1; sample NEAREST, NoColorSpace, no mipmaps',
  },
}
writeFileSync(`${base}.json`, `${JSON.stringify(meta, null, 2)}\n`)

console.log(`${basename(glbPath)} -> ${basename(base)}.{png,rgb.png,json}`)
console.log(`  triangles   ${triangles.length}`)
console.log(`  bounds x    ${round(minX, 2)} .. ${round(maxX, 2)}`)
console.log(`  bounds z    ${round(minZ, 2)} .. ${round(maxZ, 2)}`)
console.log(`  size        ${round(size)} m (square window, origin ${meta.origin})`)
console.log(`  height      ${round(minY)} .. ${round(maxY)} m (range ${round(range)})`)
console.log(`  texel       ${round(texelSize)} m`)
console.log(`  grey step   ${round(range / 255, 4)} m`)
console.log(`  unclaimed   ${empty} texels (${round(empty / height.length * 100, 2)}%), clamped/ramped from the mesh edge`)
