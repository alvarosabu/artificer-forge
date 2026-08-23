/**
 * A distance-driven quadtree over the level's XZ square. No geometry and no Three
 * types in here on purpose: it answers one question — "which squares, at which
 * sizes, cover the level from where the camera is standing?" — and the mesh layer
 * turns that answer into instances.
 *
 * Rebuilt from scratch every frame. That sounds expensive and is not: the whole
 * traversal is a few hundred float compares, and the node objects come out of a
 * pool, so a frame allocates nothing once the pool has warmed up. The alternative
 * (an incremental tree that patches itself) costs more code than it saves work.
 */

/** One leaf of the tree: an axis-aligned square in world XZ, at its LOD depth. */
export interface QuadtreeNode {
  /** world X of the square's minimum corner */
  x: number
  /** world Z of the square's minimum corner */
  z: number
  /** edge length in metres */
  size: number
  /** 0 is the whole level; each level down halves the size */
  depth: number
}

export interface QuadtreeSettings {
  /** edge length of the root square, in metres */
  size: number
  /** world XZ centre of that square */
  origin?: [number, number]
  /**
   * How many times a square may split. The finest node is size / 2^maxDepth, and
   * pushing that below the height map's texel size buys vertices that all sample
   * the same texels.
   */
  maxDepth?: number
  /**
   * Split radius as a multiple of the node's own edge. A node splits when the
   * camera is closer than `splitFactor * size` to it, so the whole tree scales
   * with itself: raise this for more detail further out, at more triangles.
   */
  splitFactor?: number
}

export interface Quadtree {
  size: number
  origin: [number, number]
  maxDepth: number
  splitFactor: number
  /**
   * The leaves from the last update. Pooled and reused, so only the first `count`
   * entries are live and the array must be read, never held.
   */
  nodes: QuadtreeNode[]
  /** how many entries of `nodes` the last update filled */
  count: number
  /** re-run the traversal for a camera at this world XZ; returns the new count */
  update: (cameraX: number, cameraZ: number) => number
}

export function createQuadtree({
  size, origin = [0, 0], maxDepth = 4, splitFactor = 1.5,
}: QuadtreeSettings): Quadtree {
  const nodes: QuadtreeNode[] = []

  const tree: Quadtree = {
    size,
    origin,
    maxDepth,
    splitFactor,
    nodes,
    count: 0,
    update(cameraX: number, cameraZ: number) {
      tree.count = 0
      descend(origin[0] - size / 2, origin[1] - size / 2, size, 0, cameraX, cameraZ)
      return tree.count
    },
  }

  function emit(x: number, z: number, nodeSize: number, depth: number) {
    // grow the pool once, then only ever overwrite: a frame that needs more nodes
    // than the last one is the only frame that allocates
    const existing = nodes[tree.count]
    if (existing) {
      existing.x = x
      existing.z = z
      existing.size = nodeSize
      existing.depth = depth
    }
    else {
      nodes[tree.count] = { x, z, size: nodeSize, depth }
    }
    tree.count++
  }

  function descend(x: number, z: number, nodeSize: number, depth: number, cameraX: number, cameraZ: number) {
    if (depth >= tree.maxDepth) {
      emit(x, z, nodeSize, depth)
      return
    }

    // Distance to the NEAREST POINT of the square, not to its centre. Centre
    // distance is what makes the node you are standing on refuse to split: for a
    // big node the camera can be inside it and still be further from the middle
    // than the split radius.
    const nearestX = cameraX < x ? x : cameraX > x + nodeSize ? x + nodeSize : cameraX
    const nearestZ = cameraZ < z ? z : cameraZ > z + nodeSize ? z + nodeSize : cameraZ
    const dx = cameraX - nearestX
    const dz = cameraZ - nearestZ
    const radius = tree.splitFactor * nodeSize

    if (dx * dx + dz * dz > radius * radius) {
      emit(x, z, nodeSize, depth)
      return
    }

    const half = nodeSize / 2
    descend(x, z, half, depth + 1, cameraX, cameraZ)
    descend(x + half, z, half, depth + 1, cameraX, cameraZ)
    descend(x, z + half, half, depth + 1, cameraX, cameraZ)
    descend(x + half, z + half, half, depth + 1, cameraX, cameraZ)
  }

  return tree
}
