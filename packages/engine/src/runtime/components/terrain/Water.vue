<script setup lang="ts">
import { PlaneGeometry } from 'three'
import type { Texture } from 'three/webgpu'
import { buildWaterMaterial, type WaterUniforms } from '../../terrain/waterMaterial'
import type { ControlMap } from '../../terrain/controlMap'
import type { GradingContext } from '../../grading/grading'

const props = withDefaults(defineProps<{
  control: ControlMap
  normalMap?: Texture
  level?: number
  grading?: GradingContext | null
  /** createWaterUniforms() bag; write into `.value` to retune without a rebuild */
  uniforms?: WaterUniforms
}>(), {
  level: -0.35,
})

// one quad covering the whole control map: the mask decides where it reads as water
const geometry = new PlaneGeometry(props.control.size, props.control.size, 1, 1)
geometry.rotateX(-Math.PI / 2)

const { material, uniforms } = buildWaterMaterial({
  control: props.control,
  grading: props.grading,
  normalMap: props.normalMap,
  uniforms: props.uniforms,
})

defineExpose({ uniforms })
</script>

<template>
  <TresMesh
    name="water"
    :geometry="geometry"
    :material="material"
    :position-y="props.level"
  />
</template>
