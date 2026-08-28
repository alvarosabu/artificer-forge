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

// Unit grid for one node, stretched over its square in the vertex shader. The extra
// ring (`skirt = 1`) is clamped onto the border and dropped by the shader to plug LOD cracks.
function createNodeGrid(segments: number): BufferGeometry {
  const side = segments + 3 // interior grid (segments + 1) plus a ring on each side
  const count = side * side

  const positions = new Float32Array(count * 3)
  const normals = new Float32Array(count * 3)
  const skirt = new Float32Array(count)

  for (let j = 0; j < side; j++) {
    const v = Math.min(Math.max((j - 1) / segments, 0), 1)
    for (let i = 0; i < side; i++) {
      const u = Math.min(Math.max((i - 1) / segments, 0), 1)
      const k = j * side + i
      positions[k * 3] = u
      positions[k * 3 + 1] = 0
      positions[k * 3 + 2] = v
      // three reads the normal attribute before normalNode runs, so it must exist
      // even though the material replaces it
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
  field: HeightField
  control: ControlMap
  grading?: GradingContext | null
  grassMap?: Texture
  groundMap?: Texture
  roadMap?: Texture
  rockMap?: Texture
  uniforms?: TerrainUniforms
  /** quads per side of one node; trades triangles per node against node count */
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
  material: MeshLambertNodeMaterial
  skirtDepth: UniformNode<'float', number>
  setWireframe: (value: boolean) => void
  nodeCount: number
  update: (cameraX: number, cameraZ: number) => void
  dispose: () => void
}

const _hit = new Vector3()
const _normal = new Vector3(0, 1, 0)

// One draw call: a unit grid instanced per quadtree leaf, placed and heightened in
// the vertex shader. A LOD change is an attribute write, not a geometry rebuild.
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

  // (x, z, size) packed in one attribute: WebGPU allows only 8 vertex buffers per pipeline
  let capacity = 256
  let nodeTransforms = new Float32Array(capacity * 3)
  let nodeAttribute = new InstancedBufferAttribute(nodeTransforms, 3)
  nodeAttribute.setUsage(DynamicDrawUsage)
  geometry.setAttribute('nodeTransform', nodeAttribute)

  // the shader moves every vertex, so bound the whole level instead of the unit grid
  geometry.boundingSphere = new Sphere(
    new Vector3(field.origin.x, field.minHeight + field.heightRange / 2, field.origin.y),
    Math.hypot(field.size, field.heightRange, field.size) / 2,
  )

  const skirtDepthUniform = uniform(skirtDepth)

  const { material, uniforms: terrainUniforms } = buildTerrainMaterial({
    control, grading, grassMap, groundMap, roadMap, rockMap, uniforms,
  })

  const nodeTransform = attribute<'vec3'>('nodeTransform', 'vec3')
  const worldXZ = nodeTransform.xy.add(positionGeometry.xz.mul(nodeTransform.z))

  material.positionNode = Fn(() => {
    const xz = worldXZ.toVar()
    const height = sampleHeight(field, xz).toVar()
    // skirt scales with node size: a coarser node's edge misses the surface by more
    const drop = attribute<'float'>('skirt', 'float')
      .mul(skirtDepthUniform)
      .mul(nodeTransform.z.div(field.size))
    return vec3(xz.x, height.sub(drop), xz.y)
  })()

  // Normals from the height map, not the triangles, so shading (and the rock-on-slope
  // mask in terrainMaterial) is identical at every LOD.
  material.normalNode = Fn(() => {
    const xz = positionWorld.xz.toVar()
    const step = field.uniforms.texelSize
    const left = sampleHeight(field, xz.sub(vec2(step, 0)))
    const right = sampleHeight(field, xz.add(vec2(step, 0)))
    const back = sampleHeight(field, xz.sub(vec2(0, step)))
    const front = sampleHeight(field, xz.add(vec2(0, step)))
    const worldNormal = normalize(vec3(left.sub(right), step.mul(2), back.sub(front)))
    // normalNode is read as a view-space normal (NodeMaterial.setupNormal feeds
    // normalView), so rotate world -> view here; mat3 drops the camera translation
    return normalize(mat3(cameraViewMatrix).mul(worldNormal))
  })()

  const mesh = new Mesh(geometry, material)
  mesh.name = 'terrain-quadtree'
  mesh.receiveShadow = true
  // positionNode emits world coordinates; any mesh transform would shift the
  // terrain off its height map
  mesh.matrixAutoUpdate = false
  mesh.frustumCulled = false

  // Pick against the height map: the CPU-side geometry is a flat unit square, so
  // the default raycast would hit a 1 m plane at the origin.
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
      // topology is baked into the compiled pipeline; the flag alone keeps drawing triangles
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
      // upload every frame: a 3 KB write is cheaper than tracking which nodes moved
      nodeAttribute.needsUpdate = true
      geometry.instanceCount = count
      api.nodeCount = count
    },
    dispose() {
      // grid is not disposed: geometry took over its attributes, disposing both
      // releases the same buffers twice
      geometry.dispose()
      material.dispose()
    },
  }

  return api
}
