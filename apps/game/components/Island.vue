<script setup lang="ts">
import { useGLTF } from '@tresjs/cientos'
import { RigidBody } from '@tresjs/rapier'
import { applyGradingToModel, sampleHeight } from '@artificer-forge/engine/runtime'
import { Euler, Quaternion, Vector3 } from 'three'
import { float, positionWorld } from 'three/tsl'
import type { Mesh, Object3D } from 'three'

const TERRAIN = '/models/levels/portfolio-island-terrain'

const grading = useGrading()

const { state: terrainState } = useGLTF(`${TERRAIN}.glb`, { draco: true })
const { state: sceneryState } = useGLTF('/models/levels/portfolio-island.glb', { draco: true })
const terrain = computed(() => terrainState.value?.scene)
const scenery = computed(() => sceneryState.value?.scene)

const { field: heightField, heightAt } = useHeightField(`${TERRAIN}.height-2048`)
const colliders = useStaticColliders()
const collidersBuilt = ref(false)

// An empty placed in Blender. The origin is the fallback if the model has no such node.
const SPAWN_NODE = 'Spawn_Point_Beach'
const spawn = ref<[number, number, number]>([0, 0, 0])

// Blender exports a collision hull next to each solid prop, named `<mesh>-convcolonly`
const isHull = (mesh: Mesh) => mesh.name.includes('-convcolonly')
// A `-rigid` mesh is a dynamic body whose collider comes from its own geometry (Godot's suffix,
// as read by `tres gltf --physics rapier`). `includes`, because Blender's `.001` arrives as `001`.
const isRigid = (object: Object3D) => object.name.includes('-rigid')

interface RigidProp {
  mesh: Mesh
  position: Vector3
  rotation: Euler
  // `-rigid-cuboid` asks for a box; a bare `-rigid` hulls the mesh, as Godot and the CLI do.
  collider: 'cuboid' | 'convexHull'
}
const rigidProps = shallowRef<RigidProp[]>([])

watch([terrain, scenery, heightField], ([terrainModel, sceneryModel, field]) => {
  if (!terrainModel || !sceneryModel || !field || collidersBuilt.value) return

  terrainModel.traverse((child) => {
    if ((child as Mesh).isMesh) child.receiveShadow = true
  })
  sceneryModel.traverse((child) => {
    const mesh = child as Mesh
    if (!mesh.isMesh) return
    if (isHull(mesh)) mesh.visible = false
    else mesh.castShadow = mesh.receiveShadow = true
  })

  // Contact occlusion darkens whatever is near the ground. The terrain is the ground,
  // so its ground goes far below it; props measure from the terrain under them.
  applyGradingToModel(terrainModel, grading, { groundHeight: float(-1e4) })
  applyGradingToModel(sceneryModel, grading, { groundHeight: sampleHeight(field, positionWorld.xz) })

  // The model is not in the scene yet, so its world matrices are not computed.
  sceneryModel.updateMatrixWorld(true)

  const spawnNode = sceneryModel.getObjectByName(SPAWN_NODE)
  if (spawnNode) {
    spawn.value = spawnNode.getWorldPosition(new Vector3()).toArray()
  }
  else {
    console.warn(`[Island] no "${SPAWN_NODE}" node in the scenery model, spawning at the origin`)
  }

  const rigidMeshes: Mesh[] = []
  sceneryModel.traverse((child) => {
    if ((child as Mesh).isMesh && isRigid(child)) rigidMeshes.push(child as Mesh)
  })
  // Detached after the traverse: removing a node while traversing skips its siblings.
  // RigidBody seeds the body from its own group and builds the collider from the mesh's local
  // transform, so the pose moves to the body and the mesh goes to the body's origin.
  rigidProps.value = rigidMeshes.map((mesh) => {
    const position = mesh.getWorldPosition(new Vector3())
    const rotation = new Euler().setFromQuaternion(mesh.getWorldQuaternion(new Quaternion()))
    mesh.removeFromParent()
    mesh.position.set(0, 0, 0)
    mesh.quaternion.identity()
    const collider = mesh.name.includes('-cuboid') ? 'cuboid' : 'convexHull'
    return { mesh, position, rotation, collider }
  })

  colliders.build(terrainModel, () => 'trimesh')
  colliders.build(sceneryModel, mesh => (isHull(mesh) ? 'convexHull' : null))
  collidersBuilt.value = true
}, { immediate: true })
</script>

<template>
  <primitive
    v-if="terrain"
    :object="terrain"
  />
  <primitive
    v-if="scenery"
    :object="scenery"
  />
  <RigidBody
    v-for="prop in rigidProps"
    :key="prop.mesh.uuid"
    type="dynamic"
    :collider="prop.collider"
    :position="prop.position"
    :rotation="prop.rotation"
  >
    <primitive :object="prop.mesh" />
  </RigidBody>
  <Ocean
    v-if="heightField"
    :size="heightField.size"
    :position="[heightField.origin.x, 0, heightField.origin.y]"
  />
  <!-- Only once the colliders exist: a body that moves before them falls through the island. -->
  <slot
    v-if="collidersBuilt && heightField"
    v-bind="{ heightField, heightAt, spawn }"
  />
</template>
