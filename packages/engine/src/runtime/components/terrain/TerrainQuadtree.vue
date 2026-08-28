<script setup lang="ts">
import { useLoop, type TresPointerEvent } from '@tresjs/core'
import type { Texture } from 'three/webgpu'
import { createTerrainQuadtree } from '../../terrain/quadtreeMesh'
import type { TerrainUniforms } from '../../terrain/terrainMaterial'
import type { HeightField } from '../../terrain/heightField'
import type { ControlMap } from '../../terrain/controlMap'
import type { GradingContext } from '../../grading/grading'

const props = withDefaults(defineProps<{
  field: HeightField
  control: ControlMap
  grading?: GradingContext | null
  grassMap?: Texture
  groundMap?: Texture
  roadMap?: Texture
  rockMap?: Texture
  uniforms?: TerrainUniforms
  /** not live: the grid is built once on mount */
  segments?: number
  maxDepth?: number
  splitFactor?: number
  skirtDepth?: number
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

// built once: the node graph bakes in which maps exist, so a map that arrives later is ignored
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

// segments has no watch: it decides the shared grid's vertex layout
watch(() => props.maxDepth, (value) => { terrain.quadtree.maxDepth = value })
watch(() => props.splitFactor, (value) => { terrain.quadtree.splitFactor = value })
watch(() => props.skirtDepth, (value) => { terrain.skirtDepth.value = value })
watch(() => props.wireframe, value => terrain.setWireframe(value))

const nodeCount = ref(0)

// useTresContext().camera is the camera manager, not a ref; the loop's camera is a
// ref and needs toValue(), a plain null check on it passes and then throws
const { onBeforeRender } = useLoop()
onBeforeRender(({ camera }) => {
  const position = toValue(camera)?.position
  if (!position) return
  terrain.update(position.x, position.z)
  nodeCount.value = terrain.nodeCount
})

// prime at the level centre so frame one is not empty
terrain.update(props.field.origin.x, props.field.origin.y)

function handleClick(event: TresPointerEvent) {
  emit('click', event)
}

onUnmounted(() => terrain.dispose())

defineExpose({ uniforms: terrain.uniforms, quadtree: terrain.quadtree, material: terrain.material, nodeCount })
</script>

<template>
  <!-- primitive, not TresMesh: the mesh carries a raycast override and a frozen matrix -->
  <primitive
    :object="terrain.mesh"
    @click="handleClick"
  />
</template>
