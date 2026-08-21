<script setup lang="ts">
import { BufferGeometry } from 'three'
import type { TresPointerEvent } from '@tresjs/core'
import { buildTerrainMaterial, type TerrainUniforms } from '../../terrain/terrainMaterial'
import type { ControlMap } from '../../terrain/controlMap'
import type { GradingContext } from '../../grading/grading'
import type { Texture } from 'three/webgpu'

const props = defineProps<{
  control: ControlMap
  geometry: BufferGeometry
  grading?: GradingContext | null
  grassMap?: Texture
  groundMap?: Texture
  roadMap?: Texture
  rockMap?: Texture
  /** createTerrainUniforms() bag; write into `.value` to retune without a rebuild */
  uniforms?: TerrainUniforms
}>()

// click-to-move needs a pickable ground, same contract as Floor.vue
const emit = defineEmits<{
  click: [event: TresPointerEvent]
}>()

function handleClick(event: TresPointerEvent) {
  emit('click', event)
}

// built once, on mount: the node graph bakes in which maps exist, so a map that
// arrives later is ignored. Gate the mesh on its textures where you use it.
const { material } = buildTerrainMaterial({
  control: props.control,
  uniforms: props.uniforms,
  grading: props.grading,
  grassMap: props.grassMap,
  roadMap: props.roadMap,
  rockMap: props.rockMap,
})
</script>

<template>
  <TresMesh
    name="terrain"
    :geometry="props.geometry"
    :material="material"
    cast-shadow
    receive-shadow
    @click="handleClick"
  />
</template>
