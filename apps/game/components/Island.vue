<script setup lang="ts">
import { useGLTF, useTexture } from '@tresjs/cientos'
import { useControls } from '@tresjs/leches'
import { RigidBody } from '@tresjs/rapier'
import { applyGradingToModel, buildTerrainMaterial, combineWaterQueries, createControlMap, createTerrainUniforms, extractPalmCrownReferences, extractTorchFlameReferences, PalmFronds, sampleHeight, TorchFlames } from '@artificer-forge/engine/runtime'
import { Euler, Quaternion, Vector2, Vector3 } from 'three'
import { float, positionWorld, uniform } from 'three/tsl'
import type { Color, Mesh, Object3D, Texture } from 'three'

const TERRAIN = '/models/levels/portfolio-island-terrain'
const CONTROL_MAP = '/models/levels/level-control-1024.png'
const OCEAN_LEVEL = 0
const waterAt = combineWaterQueries(
  () => OCEAN_LEVEL,
  //  createWaterQuery(control, () => terrain.waterLevel.value, water),
)

const grading = useGrading()
const wind = useWind()

const { state: terrainState } = useGLTF(`${TERRAIN}.glb`, { draco: true })
const { state: sceneryState } = useGLTF('/models/levels/portfolio-island.glb', { draco: true })
const terrain = computed(() => terrainState.value?.scene)
const scenery = computed(() => sceneryState.value?.scene)

const { field: heightField, heightAt } = useHeightField(`${TERRAIN}.height-2048`)
const colliders = useStaticColliders()
const collidersBuilt = ref(false)

// useTexture holds a pixel-less Texture until the file lands; a WebGPU material bound to one leaves a blank page
function whenLoaded<T extends Texture>(source: { value: T | null | undefined }) {
  return computed(() => (source.value?.image ? source.value : null))
}
const controlTexture = whenLoaded(useTexture(CONTROL_MAP).state)
const grassMap = whenLoaded(useTexture('/textures/grass.webp').state)
const roadMap = whenLoaded(useTexture('/textures/road.webp').state)
const rockMap = whenLoaded(useTexture('/textures/rock.webp').state)

const terrainUniforms = createTerrainUniforms()
terrainUniforms.waterLevel.value = OCEAN_LEVEL
// No ground map on purpose: bare ground is sand, a noise gradient around the GLB's old flat colour
terrainUniforms.groundDark.value.set('#d9bd72')
terrainUniforms.groundLight.value.set('#efd890')
const terrainMaterialReady = ref(false)

const shoreWaves = createShoreWaves()
provideShoreWaves(shoreWaves)
const playerPosition = usePlayerPosition()
const playerXZ = uniform(new Vector2())
watch(playerPosition, ([x, , z]) => { playerXZ.value.set(x, z) }, { immediate: true })

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
const palmCrowns = shallowRef<Object3D[]>([])
const torchFlames = shallowRef<Object3D[]>([])

const uuid = inject<string>('uuid')
// Frond length in marker radii. The marker sphere shows where a crown sits, not how far it reaches
const { palmsSize } = useControls('🌴 palms', {
  size: { value: 5, min: 0.5, max: 10, step: 0.1, type: 'range' },
}, { uuid })

const {
  torchesRise,
  torchesDisplace,
  torchesFlicker,
  torchesLean,
  torchesEmission,
  torchesGlow,
  torchesLightColor,
  torchesLightIntensity,
  torchesLightRadius,
  torchesLightFlicker,
  torchesEmberCount,
  torchesEmberSize,
  torchesEmberRise,
  torchesEmberDrift,
} = useControls('🔥 torches', {
  rise: { value: 0.7, min: 0, max: 3, step: 0.05, type: 'range' },
  displace: { value: 0.12, min: 0, max: 0.5, step: 0.01, type: 'range' },
  flicker: { value: 0.06, min: 0, max: 0.3, step: 0.01, type: 'range' },
  lean: { value: 0.6, min: 0, max: 2, step: 0.05, type: 'range' },
  emission: { value: 0.6, min: 0, max: 1, step: 0.05, type: 'range' },
  glow: { value: 2.5, min: 0, max: 8, step: 0.1, type: 'range' },
  lightColor: '#ff8a3d',
  lightIntensity: { value: 1.5, min: 0, max: 5, step: 0.05, type: 'range' },
  lightRadius: { value: 6, min: 0.5, max: 20, step: 0.25, type: 'range' },
  lightFlicker: { value: 0.15, min: 0, max: 1, step: 0.01, type: 'range' },
  emberCount: { value: 12, min: 0, max: 64, step: 1, type: 'range' },
  emberSize: { value: 0.07, min: 0.005, max: 0.15, step: 0.005, type: 'range' },
  emberRise: { value: 1.5, min: 0, max: 8, step: 0.1, type: 'range' },
  emberDrift: { value: 1, min: 0, max: 8, step: 0.1, type: 'range' },
}, { uuid })

const hex = (u: { value: Color }) => `#${u.value.getHexString()}`
const { terrainGrassTint, terrainSandDark, terrainSandLight, terrainRockTint, terrainGrassLow, terrainGrassHigh, terrainEdge } = useControls('⛰️ terrain', {
  grassTint: { value: hex(terrainUniforms.grassTint), type: 'color' },
  sandDark: { value: hex(terrainUniforms.groundDark), type: 'color' },
  sandLight: { value: hex(terrainUniforms.groundLight), type: 'color' },
  rockTint: { value: hex(terrainUniforms.rockTint), type: 'color' },
  grassLow: { value: terrainUniforms.grassBlendLow.value, min: 0, max: 1, step: 0.01, type: 'range' },
  grassHigh: { value: terrainUniforms.grassBlendHigh.value, min: 0, max: 1, step: 0.01, type: 'range' },
  edge: { value: terrainUniforms.edgeStrength.value, min: 0, max: 2, step: 0.05, type: 'range' },
}, { uuid })

watch(terrainGrassTint!, (v) => { terrainUniforms.grassTint.value.set(v) })
watch(terrainSandDark!, (v) => { terrainUniforms.groundDark.value.set(v) })
watch(terrainSandLight!, (v) => { terrainUniforms.groundLight.value.set(v) })
watch(terrainRockTint!, (v) => { terrainUniforms.rockTint.value.set(v) })
watch(terrainGrassLow!, (v) => { terrainUniforms.grassBlendLow.value = v })
watch(terrainGrassHigh!, (v) => { terrainUniforms.grassBlendHigh.value = v })
watch(terrainEdge!, (v) => { terrainUniforms.edgeStrength.value = v })

// Built once: the node graph bakes in which maps exist, so a map that loads later would be ignored
watch([terrain, heightField, controlTexture, grassMap, roadMap, rockMap], ([model, field, control, grass, road, rock]) => {
  if (!model || !field || !control || !grass || !road || !rock || terrainMaterialReady.value) return
  // The control map covers the same top-down square as the height field: the terrain's bounds
  const { material } = buildTerrainMaterial({
    control: createControlMap({ texture: control, size: field.size, origin: [field.origin.x, field.origin.y] }),
    grading,
    grassMap: grass,
    roadMap: road,
    rockMap: rock,
    uniforms: terrainUniforms,
    wetness: sandWetness(shoreWaves, float(OCEAN_LEVEL).sub(positionWorld.y), positionWorld.xz.distance(playerXZ)),
  })
  model.traverse((child) => {
    if ((child as Mesh).isMesh) (child as Mesh).material = material
  })
  terrainMaterialReady.value = true
}, { immediate: true })

watch([terrain, scenery, heightField], ([terrainModel, sceneryModel, field]) => {
  if (!terrainModel || !sceneryModel || !field || collidersBuilt.value) return

  terrainModel.traverse((child) => {
    if ((child as Mesh).isMesh) child.receiveShadow = true
  })
  palmCrowns.value = extractPalmCrownReferences(sceneryModel, { frondScale: palmsSize!.value })
  torchFlames.value = extractTorchFlameReferences(sceneryModel)

  sceneryModel.traverse((child) => {
    const mesh = child as Mesh
    if (!mesh.isMesh) return
    if (isHull(mesh)) mesh.visible = false
    else mesh.castShadow = mesh.receiveShadow = true
  })

  // Props measure contact occlusion from the terrain under them
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

// The markers stay in the scene (hidden), so the crowns can be read again at the new size
watch(palmsSize!, (frondScale) => {
  if (scenery.value && collidersBuilt.value) palmCrowns.value = extractPalmCrownReferences(scenery.value, { frondScale })
})
</script>

<template>
  <!-- gated on the material so the raw GLB material never shows for a frame -->
  <primitive
    v-if="terrain && terrainMaterialReady"
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
  <!-- PalmFronds bakes its references at creation, so a resize needs a remount -->
  <PalmFronds
    v-if="palmCrowns.length"
    :key="palmsSize"
    :references="palmCrowns"
    :grading="grading"
    :wind-angle="wind.angle"
    :wind-strength="wind.strength"
  />
  <TorchFlames
    v-if="torchFlames.length"
    :key="torchesEmberCount"
    :references="torchFlames"
    :grading="grading"
    :wind-angle="wind.angle"
    :wind-strength="wind.strength"
    :rise-speed="torchesRise"
    :displace-strength="torchesDisplace"
    :flicker="torchesFlicker"
    :wind-lean="torchesLean"
    :emission="torchesEmission"
    :glow-intensity="torchesGlow"
    :light-color="torchesLightColor"
    :light-intensity="torchesLightIntensity"
    :light-radius="torchesLightRadius"
    :light-flicker="torchesLightFlicker"
    :ember-count="torchesEmberCount"
    :ember-size="torchesEmberSize"
    :ember-rise="torchesEmberRise"
    :ember-drift="torchesEmberDrift"
  />
  <Ocean
    v-if="heightField"
    :height-field="heightField"
  />
  <!-- Only once the colliders exist: a body that moves before them falls through the island. -->
  <slot
    v-if="collidersBuilt && heightField"
    v-bind="{ heightField, heightAt, spawn, waterAt }"
  />
</template>
