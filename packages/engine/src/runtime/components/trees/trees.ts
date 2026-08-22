import { Mesh, Object3D, Sphere } from 'three'

export interface CanopyExtractOptions {
  /**
   * Node-name prefixes that mark a canopy blob. Matched with startsWith against the
   * glTF NODE name — that is what three.js copies onto `Mesh.name`, and it is NOT the
   * mesh datablock name (in testbed.glb the canopy nodes are `Tree_Cannopy_*` while
   * their meshes are still called `Tree_Bare_*.00n`).
   */
  namePrefix?: string | string[]
  /** Take the markers out of the scene graph so they never render. */
  detach?: boolean
}

// Both spellings on purpose: the level was authored as 'Cannopy', and fixing that
// typo in Blender must not silently drop every canopy in the level.
const DEFAULT_PREFIXES = ['Tree_Cannopy', 'Tree_Canopy']

/**
 * Turn canopy marker meshes into `Foliage` references.
 *
 * A canopy is authored in Blender as a plain icosphere per leaf blob — invisible at
 * runtime, there only to carry a position and a radius. The radius comes from the
 * marker's BOUNDING SPHERE rather than its node transform, because Blender's exporter
 * bakes an object's loc/scale into the vertices as soon as the transform is applied:
 * the testbed markers all arrive with an identity node matrix, so reading the node
 * (Bruno's approach, where the markers keep their transforms) would pile every blob at
 * the trunk's origin at radius 1. The bounding sphere is the same answer when the
 * transform IS live, so it works either way.
 *
 * Returns one `Object3D` per blob: position = blob centre, uniform scale = blob radius
 * in metres. Callers scale that down to a cluster core scale (see Trees.vue).
 */
export function extractCanopyReferences(root: Object3D, options: CanopyExtractOptions = {}): Object3D[] {
  const { namePrefix = DEFAULT_PREFIXES, detach = true } = options
  const prefixes = Array.isArray(namePrefix) ? namePrefix : [namePrefix]

  root.updateMatrixWorld(true)

  // Collect before mutating: removeFromParent() inside traverse() edits the children
  // array being walked, which skips siblings.
  const markers: Mesh[] = []
  root.traverse((child) => {
    if (child instanceof Mesh && prefixes.some(prefix => child.name.startsWith(prefix)))
      markers.push(child)
  })

  const references: Object3D[] = []
  const sphere = new Sphere()

  for (const marker of markers) {
    if (!marker.geometry.boundingSphere) marker.geometry.computeBoundingSphere()
    if (!marker.geometry.boundingSphere) continue

    // Sphere.applyMatrix4 moves the centre and scales the radius by the matrix's
    // largest axis — exactly the blob's world position and world radius.
    sphere.copy(marker.geometry.boundingSphere).applyMatrix4(marker.matrixWorld)

    const reference = new Object3D()
    reference.position.copy(sphere.center)
    reference.scale.setScalar(sphere.radius)
    reference.updateMatrixWorld()
    references.push(reference)

    // Detach only — never dispose. Object3D.clone() shares geometry with the scene
    // useGLTF holds in its url cache, so disposing here would blank the trees on the
    // next load from that cache.
    if (detach) marker.removeFromParent()
  }

  return references
}
