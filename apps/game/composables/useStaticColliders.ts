import { useRapier } from '@tresjs/rapier'
import { Vector3 } from 'three'
import type { Mesh, Object3D } from 'three'

export type StaticColliderShape = 'trimesh' | 'convexHull'

/**
 * Builds fixed Rapier colliders from the meshes of a loaded model. Call it inside `<Physics>`.
 *
 * The vertices are baked in world space. tres-rapier's auto colliders read only each mesh's
 * local transform, so a mesh nested under another GLB node lands in the wrong place.
 */
export function useStaticColliders() {
  const { world, rapier } = useRapier()
  let body: ReturnType<typeof world.value.createRigidBody> | null = null
  const vertex = new Vector3()

  /** `shapeOf` picks the shape per mesh. Return null to skip a mesh. */
  function build(model: Object3D, shapeOf: (mesh: Mesh) => StaticColliderShape | null) {
    body ??= world.value.createRigidBody(rapier.value.RigidBodyDesc.fixed())
    model.updateWorldMatrix(true, true)

    model.traverse((child) => {
      const mesh = child as Mesh
      if (!mesh.isMesh) return
      const shape = shapeOf(mesh)
      if (!shape) return

      // fromBufferAttribute, not `.array`: GLTFLoader can return interleaved attributes
      const position = mesh.geometry.getAttribute('position')
      const vertices = new Float32Array(position.count * 3)
      for (let i = 0; i < position.count; i++) {
        vertex.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld)
        vertices[i * 3] = vertex.x
        vertices[i * 3 + 1] = vertex.y
        vertices[i * 3 + 2] = vertex.z
      }

      let desc
      if (shape === 'trimesh') {
        const index = mesh.geometry.index
        const indices = index
          ? Uint32Array.from(index.array)
          : Uint32Array.from({ length: position.count }, (_, i) => i)
        desc = rapier.value.ColliderDesc.trimesh(vertices, indices)
      }
      else {
        desc = rapier.value.ColliderDesc.convexHull(vertices)
      }
      // convexHull returns null for flat or degenerate point sets
      if (!desc) {
        console.warn(`[useStaticColliders] no ${shape} for "${mesh.name}"`)
        return
      }
      world.value.createCollider(desc, body!)
    })
  }

  onScopeDispose(() => {
    // the world can be gone already when <Physics> unmounts first
    if (body && world.value?.getRigidBody(body.handle)) world.value.removeRigidBody(body)
    body = null
  })

  return { build }
}
