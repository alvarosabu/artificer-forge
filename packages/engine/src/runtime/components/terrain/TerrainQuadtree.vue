<script setup lang="ts">
import { useLoop, type TresPointerEvent } from '@tresjs/core'
import type { Texture } from 'three/webgpu'
import { createTerrainQuadtree } from '../../terrain/quadtreeMesh'
import type { TerrainUniforms } from '../../terrain/terrainMaterial'
import type { HeightField } from '../../terrain/heightField'
import type { ControlMap } from '../../terrain/controlMap'
import type { GradingContext } from '../../grading/grading'

const props = withDefaults(defineProps<{
  /** the height map; its size and origin define the terrain's extent */
  field: HeightField
  control: ControlMap
  grading?: GradingContext | null
  grassMap?: Texture
  groundMap?: Texture
  roadMap?: Texture
  rockMap?: Texture
  /** createTerrainUniforms() bag; write into `.value` to retune without a rebuild */
  uniforms?: TerrainUniforms
  /** quads per side of one node. Changing it rebuilds the grid, so it is not live */
  segments?: number
  /** how many times a node may split; finest node is size / 2^maxDepth */
  maxDepth?: number
  /** split radius as a multiple of the node's own edge */
  splitFactor?: number
  /** metres the skirt hangs below the root node's edge */
  skirtDepth?: number
  /** draw the node grids as lines, to see the LOD layout */
  wireframe?: boolean
}>(), {
  segments: 32,
  maxDepth: 4,
  splitFactor: 1.5,
  skirtDepth: 4,
  wireframe: false,
})

// click-to-move needs a pickable ground, same contract as TerrainGround
const emit = defineEmits<{
  click: [event: TresPointerEvent]
}>()

// Built once, on mount: the node graph bakes in which surface maps exist, so a map
// that arrives later is ignored. Gate the component on its textures where you use it.
const terrain = createTerrainQuadtree({
  field: props.field,
  control: props.control,
  grading: props.grading,
  grassMap: props.grassMap,
  groundMap: props.groundMap,
  roadMap: props.roadMap,
  rockMap: props.rockMap,
  uniforms: props.uniforms,
  segments: props.segments,
  maxDepth: props.maxDepth,
  splitFactor: props.splitFactor,
  skirtDepth: props.skirtDepth,
})

terrain.setWireframe(props.wireframe)

// maxDepth and splitFactor are plain numbers on the tree, so they retune live.
// segments cannot: it decides the vertex layout of the shared grid.
watch(() => props.maxDepth, (value) => { terrain.quadtree.maxDepth = value })
watch(() => props.splitFactor, (value) => { terrain.quadtree.splitFactor = value })
watch(() => props.skirtDepth, (value) => { terrain.skirtDepth.value = value })
watch(() => props.wireframe, value => terrain.setWireframe(value))

const nodeCount = ref(0)

// The camera comes from the loop context, NOT from useTresContext().camera —
// that one is the camera MANAGER (activeCamera/cameras/registerCamera), so
// reading `.value` off it silently yields undefined and the terrain never builds.
// The loop context's `camera` IS a ref, so it needs unwrapping; the object itself
// is always truthy, which is why a plain null check on it passes and then throws.
//
// Every frame, from scratch. The traversal is a few hundred compares and writes
// into a pooled array, so re-deriving the whole tree costs less than working out
// what changed — and it means the terrain can never lag the camera by a frame.
const { onBeforeRender } = useLoop()
onBeforeRender(({ camera }) => {
  const position = toValue(camera)?.position
  if (!position) return
  terrain.update(position.x, position.z)
  nodeCount.value = terrain.nodeCount
})

// Prime it at the centre of the level so frame one is not an empty world. The
// first onBeforeRender re-solves it against the real camera a moment later.
terrain.update(props.field.origin.x, props.field.origin.y)

function handleClick(event: TresPointerEvent) {
  emit('click', event)
}

onUnmounted(() => terrain.dispose())

defineExpose({ uniforms: terrain.uniforms, quadtree: terrain.quadtree, material: terrain.material, nodeCount })
</script>

<template>
  <!-- primitive, not TresMesh: the mesh carries a raycast override (picking reads
       the height map, because the shape only exists on the GPU) and a frozen world
       matrix, and Tres would build a plain Mesh without either. -->
  <primitive
    :object="terrain.mesh"
    @click="handleClick"
  />
</template>
