<script setup lang="ts">
import { onUnmounted, watch } from 'vue'
import { Color, type ColorRepresentation } from 'three'
import { useLoop } from '@tresjs/core'
import { createGrassTufts, type GrassTuftsOptions } from './grassTufts'
import { advanceWindTime, DEFAULT_WIND_ANGLE, DEFAULT_WIND_STRENGTH } from '../wind/wind'

const props = withDefaults(defineProps<GrassTuftsOptions>(), {
  // coarse on purpose: a tuft template is ~160 verts, so each DRAWN instance
  // costs more here than a flower does
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
  control: null,
  maskLow: 0.25,
  maskHigh: 0.6,
  heightField: null,
})

const { geometry, material, uniforms, setDensity, setMaskBand, dispose } = createGrassTufts(props)

watch(() => props.colorA, (val) => { if (val !== undefined) uniforms.colorA.value.set(new Color(val as ColorRepresentation)) })
watch(() => props.colorB, (val) => { if (val !== undefined) uniforms.colorB.value.set(new Color(val as ColorRepresentation)) })
watch(() => props.height, (val) => { if (val !== undefined) uniforms.height.value = val })
watch(() => props.spread, (val) => { if (val !== undefined) uniforms.spread.value = val })
// coverage is baked and sorted, so density only moves the draw count. No rebuild
// either way: on the shader fallback it is still just a threshold.
watch(() => props.density, (val) => { setDensity(val ?? 0.35) })
// texture reference is swappable; presence/absence is decided at creation (remount to switch modes)
watch(() => props.densityMap, (val) => {
  if (val && uniforms.densityMap) uniforms.densityMap.value = val
})
// the band feeds the bake, so this re-sorts and re-uploads the instance buffer.
// Cheap enough for a slider drag, not for a per-frame animation.
watch([() => props.maskLow, () => props.maskHigh], ([low, high]) => {
  setMaskBand(low ?? 0.25, high ?? 0.6)
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
