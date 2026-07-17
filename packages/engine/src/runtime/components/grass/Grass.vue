<script setup lang="ts">
import { onUnmounted, watch } from 'vue'
import { Color, ColorRepresentation } from 'three'
import { useLoop } from '@tresjs/core'
import { createGrass, type GrassOptions } from './grass'
import { DEFAULT_WIND_ANGLE, DEFAULT_WIND_STRENGTH } from '../wind/wind'

const props = withDefaults(defineProps<GrassOptions>(), {
  subdivisions: 200,
  size: 30,
  colorA: '#b4b536',
  colorB: '#d8cf3b',
  windAngle: DEFAULT_WIND_ANGLE,
  windStrength: DEFAULT_WIND_STRENGTH,
})

const { geometry, material, uniforms, dispose } = createGrass(props)

watch(() => props.colorA, (val) => uniforms.colorA.value.set(new Color(val as ColorRepresentation)))
watch(() => props.colorB, (val) => uniforms.colorB.value.set(new Color(val as ColorRepresentation)))
// texture reference is swappable; presence/absence is decided at creation (remount to switch modes)
watch(() => props.diffuseMap, (val) => {
  if (val && uniforms.diffuseMap) uniforms.diffuseMap.value = val
})
watch(() => props.windAngle, (angle) => uniforms.wind.direction.value.set(Math.sin(angle), Math.cos(angle)))
watch(() => props.windStrength, (val) => { uniforms.wind.strength.value = val })

// localTime accumulates scaled by strength so wind speed responds to the slider
const { onBeforeRender } = useLoop()
onBeforeRender(({ delta }) => {
  uniforms.wind.localTime.value += delta * uniforms.wind.timeFrequency.value * uniforms.wind.strength.value
})

onUnmounted(dispose)
</script>

<template>
  <TresMesh :geometry="geometry" :material="material" name="Grass" receive-shadow />
</template>
