// Which squares, at which sizes, cover the level from the camera's position. Rebuilt
// every frame from a node pool: a few hundred compares and no allocations once warm,
// which is cheaper than an incremental tree that patches itself.

/** leaf square in world XZ; x/z are the minimum corner, not the centre */
export interface QuadtreeNode {
  x: number
  z: number
  size: number
  depth: number
}

export interface QuadtreeSettings {
  size: number
  /** world XZ centre, not corner */
  origin?: [number, number]
  /** finest node is size / 2^maxDepth; going below the height map texel size buys nothing */
  maxDepth?: number
  /** a node splits when the camera is within splitFactor * size of it */
  splitFactor?: number
}

export interface Quadtree {
  size: number
  origin: [number, number]
  maxDepth: number
  splitFactor: number
  /** pooled; only the first `count` entries are live, so read it, never hold it */
  nodes: QuadtreeNode[]
  count: number
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
      descend(tree.origin[0] - tree.size / 2, tree.origin[1] - tree.size / 2, tree.size, 0, cameraX, cameraZ)
      return tree.count
    },
  }

  function emit(x: number, z: number, nodeSize: number, depth: number) {
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

    // distance to the nearest point of the square, not its centre: centre distance
    // stops the node the camera stands in from splitting
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
