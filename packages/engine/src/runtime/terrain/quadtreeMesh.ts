import { BufferAttribute, BufferGeometry, DynamicDrawUsage, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, Sphere, Vector3 } from 'three'
import type { Intersection, Raycaster, Texture } from 'three'
import { attribute, cameraViewMatrix, Fn, mat3, normalize, positionGeometry, positionWorld, uniform, vec2, vec3 } from 'three/tsl'
import type { MeshLambertNodeMaterial, UniformNode } from 'three/webgpu'
import { sampleHeight, type HeightField } from './heightField'
import { intersectHeightField, readHeightPixels } from './heightMap'
import { buildTerrainMaterial, type TerrainUniforms } from './terrainMaterial'
import type { ControlMap } from './controlMap'
import type { GradingContext } from '../grading/grading'
import { createQuadtree, type Quadtree } from './quadtree'

/**
 * One node's worth of grid, in unit space: x and z run 0..1, y is flat, and the
 * vertex shader stretches it over whichever square the quadtree hands it.
 *
 * The grid carries ONE extra ring of vertices on every side, clamped back onto the
 * border and flagged `skirt = 1`. The shader drops that ring straight down, which
 * plugs the crack where a fine node meets a coarse one — the two edges disagree by
 * up to the coarse node's sampling error, and a vertical curtain under both of them
 * covers the gap without anyone needing to know their neighbour's depth.
 *
 * Clamping is what makes it free: a skirt vertex sits at exactly the same XZ as the
 * border vertex above it, so the ring adds no footprint and no seam of its own.
 */
function createNodeGrid(segments: number): BufferGeometry {
  const side = segments + 3 // interior grid (segments + 1) plus a ring on each side
  const count = side * side

  const positions = new Float32Array(count * 3)
  const normals = new Float32Array(count * 3)
  const skirt = new Float32Array(count)

  for (let j = 0; j < side; j++) {
    // the ring indices (-1/segments and (segments+1)/segments) clamp onto the edge
    const v = Math.min(Math.max((j - 1) / segments, 0), 1)
    for (let i = 0; i < side; i++) {
      const u = Math.min(Math.max((i - 1) / segments, 0), 1)
      const k = j * side + i
      positions[k * 3] = u
      positions[k * 3 + 1] = 0
      positions[k * 3 + 2] = v
      // flat +Y. The material replaces this with a height-derived normal, but the
      // attribute has to exist: three's vertex-stage normal path reads it before
      // the material's normalNode ever runs.
      normals[k * 3 + 1] = 1
      skirt[k] = (i === 0 || i === side - 1 || j === 0 || j === side - 1) ? 1 : 0
    }
  }

  const cells = side - 1
  const indices = count > 65535 ? new Uint32Array(cells * cells * 6) : new Uint16Array(cells * cells * 6)
  let n = 0
  for (let j = 0; j < cells; j++) {
    for (let i = 0; i < cells; i++) {
      const a = j * side + i
      const b = a + 1
      const c = a + side
      const d = c + 1
      // a, c, b winds counter-clockwise seen from +Y, so the front face points up
      indices[n++] = a
      indices[n++] = c
      indices[n++] = b
      indices[n++] = b
      indices[n++] = c
      indices[n++] = d
    }
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new BufferAttribute(normals, 3))
  geometry.setAttribute('skirt', new BufferAttribute(skirt, 1))
  geometry.setIndex(new BufferAttribute(indices, 1))
  return geometry
}

export interface TerrainQuadtreeSettings {
  /** the height map; its size and origin define the root square */
  field: HeightField
  control: ControlMap
  grading?: GradingContext | null
  grassMap?: Texture
  groundMap?: Texture
  roadMap?: Texture
  rockMap?: Texture
  uniforms?: TerrainUniforms
  /**
   * Quads per side of ONE node. The whole tree is this grid reused, so this trades
   * triangles per node against node count: 32 quads at depth 4 resolves the same
   * 512 samples as 64 quads at depth 3, with smaller, better-culled pieces.
   */
  segments?: number
  maxDepth?: number
  splitFactor?: number
  /** metres the skirt hangs below the ROOT node's edge; finer nodes scale down */
  skirtDepth?: number
}

export interface TerrainQuadtree {
  mesh: Mesh
  quadtree: Quadtree
  uniforms: TerrainUniforms
  /** exposed so a debug panel can flip `wireframe`; see setWireframe */
  material: MeshLambertNodeMaterial
  skirtDepth: UniformNode<'float', number>
  /**
   * Draw the node grids as lines. WebGPU switches the pipeline topology to
   * LineList for this, so the material has to be marked for a rebuild.
   */
  setWireframe: (value: boolean) => void
  /** live node count from the last update, for a debug readout */
  nodeCount: number
  /** re-run the tree for a camera at this world XZ and upload the changed nodes */
  update: (cameraX: number, cameraZ: number) => void
  dispose: () => void
}

const _hit = new Vector3()
const _normal = new Vector3(0, 1, 0)

/**
 * A terrain mesh generated from a height map, not loaded from one.
 *
 * The whole level is a single draw call: one unit grid, instanced once per quadtree
 * leaf, with the leaf's world square in an instanced attribute. The vertex shader
 * places each vertex from that square and reads its height out of the map, so
 * changing LOD is changing three floats per instance — no geometry is rebuilt, and
 * nothing is allocated on a normal frame.
 */
export function createTerrainQuadtree({
  field, control, grading, grassMap, groundMap, roadMap, rockMap, uniforms,
  segments = 32, maxDepth = 4, splitFactor = 1.5, skirtDepth = 4,
}: TerrainQuadtreeSettings): TerrainQuadtree {
  const quadtree = createQuadtree({
    size: field.size,
    origin: [field.origin.x, field.origin.y],
    maxDepth,
    splitFactor,
  })

  const grid = createNodeGrid(segments)
  const geometry = new InstancedBufferGeometry()
  geometry.index = grid.index
  for (const name of Object.keys(grid.attributes)) {
    geometry.setAttribute(name, grid.attributes[name])
  }
  geometry.instanceCount = 0

  // (x, z, size) of the node, packed into one attribute. Three floats in one
  // buffer rather than two attributes: WebGPU allows only 8 vertex buffers per
  // pipeline, and terrain is not the last thing that will want one.
  let capacity = 256
  let nodeTransforms = new Float32Array(capacity * 3)
  let nodeAttribute = new InstancedBufferAttribute(nodeTransforms, 3)
  nodeAttribute.setUsage(DynamicDrawUsage)
  geometry.setAttribute('nodeTransform', nodeAttribute)

  // the vertex shader moves every vertex, so the bounds of the unit grid mean
  // nothing. One sphere around the whole level, and no per-frame culling maths.
  geometry.boundingSphere = new Sphere(
    new Vector3(field.origin.x, field.minHeight + field.heightRange / 2, field.origin.y),
    Math.hypot(field.size, field.heightRange, field.size) / 2,
  )

  const skirtDepthUniform = uniform(skirtDepth)

  const { material, uniforms: terrainUniforms } = buildTerrainMaterial({
    control, grading, grassMap, groundMap, roadMap, rockMap, uniforms,
  })

  // world XZ of this vertex: the node's corner plus the unit grid stretched over it
  const nodeTransform = attribute<'vec3'>('nodeTransform', 'vec3')
  const worldXZ = nodeTransform.xy.add(positionGeometry.xz.mul(nodeTransform.z))

  material.positionNode = Fn(() => {
    const xz = worldXZ.toVar()
    const height = sampleHeight(field, xz).toVar()
    // Deeper skirt on a coarser node, because a coarse node's edge misses the real
    // surface by more. Proportional to the node's own size, so one number tunes
    // every level at once.
    const drop = attribute<'float'>('skirt', 'float')
      .mul(skirtDepthUniform)
      .mul(nodeTransform.z.div(field.size))
    return vec3(xz.x, height.sub(drop), xz.y)
  })()

  // Normals from the map, not from the triangles. The geometry normal would be
  // per-node-resolution and would visibly flatten as a node coarsens; central
  // differences at one texel keep the shading (and so the rock-on-slope mask in
  // terrainMaterial) identical at every LOD.
  material.normalNode = Fn(() => {
    const xz = positionWorld.xz.toVar()
    const step = field.uniforms.texelSize
    const left = sampleHeight(field, xz.sub(vec2(step, 0)))
    const right = sampleHeight(field, xz.add(vec2(step, 0)))
    const back = sampleHeight(field, xz.sub(vec2(0, step)))
    const front = sampleHeight(field, xz.add(vec2(0, step)))
    // gradient → normal: (-dh/dx, 1, -dh/dz), scaled by 2·step so the ratio holds
    const worldNormal = normalize(vec3(left.sub(right), step.mul(2), back.sub(front)))
    // normalNode is read as a VIEW space normal: NodeMaterial.setupNormal() feeds it
    // straight into normalView, and terrainMaterial's own normalWorld is derived
    // back out of that. So rotate world -> view here, with the rotation block only
    // (mat3) so the camera's translation does not move a direction.
    return normalize(mat3(cameraViewMatrix).mul(worldNormal))
  })()

  const mesh = new Mesh(geometry, material)
  mesh.name = 'terrain-quadtree'
  mesh.receiveShadow = true
  // positionNode emits WORLD coordinates, so any transform on this mesh would be
  // applied on top of them and shift the terrain off its own height map
  mesh.matrixAutoUpdate = false
  mesh.frustumCulled = false

  /**
   * Picking goes through the height map, not the triangles. The vertices the CPU
   * can see are a flat unit square — the shape only exists on the GPU — so the
   * default raycast would report hits on a 1 m plane at the origin.
   */
  mesh.raycast = (raycaster: Raycaster, intersects: Intersection[]) => {
    const pixels = readHeightPixels(field)
    if (!pixels) return
    if (!intersectHeightField(field, pixels, raycaster.ray, _hit)) return
    const distance = raycaster.ray.origin.distanceTo(_hit)
    if (distance < raycaster.near || distance > raycaster.far) return
    intersects.push({
      distance,
      point: _hit.clone(),
      object: mesh,
      normal: _normal.clone(),
      face: null,
    } as Intersection)
  }

  function ensureCapacity(needed: number) {
    if (needed <= capacity) return
    while (capacity < needed) capacity *= 2
    nodeTransforms = new Float32Array(capacity * 3)
    nodeAttribute = new InstancedBufferAttribute(nodeTransforms, 3)
    nodeAttribute.setUsage(DynamicDrawUsage)
    geometry.setAttribute('nodeTransform', nodeAttribute)
  }

  const api: TerrainQuadtree = {
    mesh,
    quadtree,
    uniforms: terrainUniforms,
    material,
    skirtDepth: skirtDepthUniform,
    setWireframe(value: boolean) {
      if (material.wireframe === value) return
      material.wireframe = value
      // the topology is baked into the compiled pipeline, so flipping the flag
      // alone would keep drawing triangles until something else invalidated it
      material.needsUpdate = true
    },
    nodeCount: 0,
    update(cameraX: number, cameraZ: number) {
      const count = quadtree.update(cameraX, cameraZ)
      ensureCapacity(count)
      const { nodes } = quadtree
      for (let i = 0; i < count; i++) {
        const node = nodes[i]
        nodeTransforms[i * 3] = node.x
        nodeTransforms[i * 3 + 1] = node.z
        nodeTransforms[i * 3 + 2] = node.size
      }
      // Upload unconditionally. The tree is recomputed every frame anyway, and a
      // 3 KB buffer write is cheaper than tracking which nodes moved.
      nodeAttribute.needsUpdate = true
      geometry.instanceCount = count
      api.nodeCount = count
    },
    dispose() {
      // grid is NOT disposed: geometry took its attributes over, and disposing both
      // fires a second release on the same buffers
      geometry.dispose()
      material.dispose()
    },
  }

  return api
}
