<script setup lang="ts">
import { onUnmounted, watch } from 'vue'
import { Color, type ColorRepresentation } from 'three'
import { useLoop } from '@tresjs/core'
import { createGrassTufts, type GrassTuftsOptions } from './grassTufts'
import { advanceWindTime, DEFAULT_WIND_ANGLE, DEFAULT_WIND_STRENGTH } from '../wind/wind'

const props = withDefaults(defineProps<GrassTuftsOptions>(), {
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
  focus: null,
})

const { geometry, material, uniforms, setDensity, setMaskBand, dispose } = createGrassTufts(props)

watch(() => props.colorA, (val) => { if (val !== undefined) uniforms.colorA.value.set(new Color(val as ColorRepresentation)) })
watch(() => props.colorB, (val) => { if (val !== undefined) uniforms.colorB.value.set(new Color(val as ColorRepresentation)) })
watch(() => props.height, (val) => { if (val !== undefined) uniforms.height.value = val })
watch(() => props.spread, (val) => { if (val !== undefined) uniforms.spread.value = val })
// no rebuild: the baked path moves the draw count, the shader path moves a threshold
watch(() => props.density, (val) => { setDensity(val ?? 0.35) })
// swap only; adding or removing the map needs a remount
watch(() => props.densityMap, (val) => {
  if (val && uniforms.densityMap) uniforms.densityMap.value = val
})
// re-sorts and re-uploads the instance buffer: fine for a slider, not per frame
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
  <!-- a following field never leaves the screen, and the origin-centred bounds would cull it by mistake -->
  <TresMesh
    :geometry="geometry"
    :material="material"
    :frustum-culled="!props.focus"
    name="GrassTufts"
    receive-shadow
  />
</template>
