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
  uniforms?: TerrainUniforms
}>()

// click-to-move needs a pickable ground, same contract as Floor.vue
const emit = defineEmits<{
  click: [event: TresPointerEvent]
}>()

function handleClick(event: TresPointerEvent) {
  emit('click', event)
}

// built once: the node graph bakes in which maps exist, so a map that arrives later is ignored
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
  <!-- receive only: casting draws the whole ground again into the shadow map (half a
       million triangles at 512 m); the look comes from stylizedOutput's mid tone -->
  <TresMesh
    name="terrain"
    :geometry="props.geometry"
    :material="material"
    receive-shadow
    @click="handleClick"
  />
</template>
