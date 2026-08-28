<script setup lang="ts">
import { onUnmounted, watch } from 'vue'
import { Color, ColorRepresentation } from 'three'
import { useLoop } from '@tresjs/core'
import { createGrass, type GrassOptions } from './grass'
import { advanceWindTime, DEFAULT_WIND_ANGLE, DEFAULT_WIND_STRENGTH } from '../wind/wind'

const props = withDefaults(defineProps<GrassOptions>(), {
  subdivisions: 200,
  size: 30,
  colorA: '#b4b536',
  colorB: '#d8cf3b',
  windAngle: DEFAULT_WIND_ANGLE,
  windStrength: DEFAULT_WIND_STRENGTH,
  control: null,
  maskLow: 0.25,
  maskHigh: 0.6,
  heightField: null,
  focus: null,
  bladeDetail: 'curved',
})

const { geometry, material, uniforms, setMaskBand, dispose } = createGrass(props)

watch(() => props.colorA, (val) => uniforms.colorA.value.set(new Color(val as ColorRepresentation)))
watch(() => props.colorB, (val) => uniforms.colorB.value.set(new Color(val as ColorRepresentation)))
// swap only; adding or removing the map needs a remount
watch(() => props.diffuseMap, (val) => {
  if (val && uniforms.diffuseMap) uniforms.diffuseMap.value = val
})
// re-sorts and re-uploads the instance buffer: fine for a slider, not per frame
watch([() => props.maskLow, () => props.maskHigh], ([low, high]) => {
  setMaskBand(low ?? 0.25, high ?? 0.6)
})
watch(() => props.windAngle, (angle) => uniforms.wind.direction.value.set(Math.sin(angle), Math.cos(angle)))
watch(() => props.windStrength, (val) => { uniforms.wind.strength.value = val })
watch(() => props.bladeWidth, (val) => { if (val !== undefined) uniforms.bladeWidth.value = val })
watch(() => props.bladeHeight, (val) => { if (val !== undefined) uniforms.bladeHeight.value = val })
watch(() => props.bladeHeightRandomness, (val) => { if (val !== undefined) uniforms.bladeHeightRandomness.value = val })
watch(() => props.shadowIntensity, (val) => { if (val !== undefined) uniforms.shadowIntensity.value = val })

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
    name="Grass"
    receive-shadow
  />
</template>
