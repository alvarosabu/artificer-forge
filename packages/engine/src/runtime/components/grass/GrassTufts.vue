<script setup lang="ts">
import { onUnmounted, watch } from 'vue'
import { Color, type ColorRepresentation } from 'three'
import { useLoop } from '@tresjs/core'
import { createGrassTufts, type GrassTuftsOptions } from './grassTufts'
import { advanceWindTime, DEFAULT_WIND_ANGLE, DEFAULT_WIND_STRENGTH } from '../wind/wind'

const props = withDefaults(defineProps<GrassTuftsOptions>(), {
  // coarse on purpose: a tuft template is ~160 verts, so rejected instances
  // cost more here than they do for flowers
  subdivisions: 20,
  size: 30,
  blades: 18,
  segments: 4,
  height: 2.2,
  spread: 0.45,
  density: 0.35,
  densityChannel: 'r',
  colorA: '#2f5d2a',
  colorB: '#7fae3c',
  windAngle: DEFAULT_WIND_ANGLE,
  windStrength: DEFAULT_WIND_STRENGTH,
})

const { geometry, material, uniforms, dispose } = createGrassTufts(props)

watch(() => props.colorA, (val) => { if (val !== undefined) uniforms.colorA.value.set(new Color(val as ColorRepresentation)) })
watch(() => props.colorB, (val) => { if (val !== undefined) uniforms.colorB.value.set(new Color(val as ColorRepresentation)) })
watch(() => props.height, (val) => { if (val !== undefined) uniforms.height.value = val })
watch(() => props.spread, (val) => { if (val !== undefined) uniforms.spread.value = val })
// coverage is a shader threshold, so density retunes live with no rebuild
watch(() => props.density, (val) => { uniforms.threshold.value = 1 - (val ?? 0.35) })
// texture reference is swappable; presence/absence is decided at creation (remount to switch modes)
watch(() => props.densityMap, (val) => {
  if (val && uniforms.densityMap) uniforms.densityMap.value = val
})
watch(() => props.windAngle, (angle) => uniforms.wind.direction.value.set(Math.sin(angle), Math.cos(angle)))
watch(() => props.windStrength, (val) => { uniforms.wind.strength.value = val })

const { onBeforeRender } = useLoop()
onBeforeRender(({ delta }) => advanceWindTime(uniforms.wind, delta))

onUnmounted(dispose)
</script>

<template>
  <TresMesh :geometry="geometry" :material="material" name="GrassTufts" receive-shadow />
</template>
