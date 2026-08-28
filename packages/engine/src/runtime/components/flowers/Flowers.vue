<script setup lang="ts">
import { onUnmounted, watch } from 'vue'
import { Color, type ColorRepresentation } from 'three'
import { useLoop } from '@tresjs/core'
import { createFlowers, type FlowersOptions } from './flowers'
import { advanceWindTime, DEFAULT_WIND_ANGLE, DEFAULT_WIND_STRENGTH } from '../wind/wind'

const props = withDefaults(defineProps<FlowersOptions>(), {
  shape: 'puff',
  subdivisions: 70,
  size: 30,
  density: 0.55,
  densityChannel: 'r',
  windAngle: DEFAULT_WIND_ANGLE,
  windStrength: DEFAULT_WIND_STRENGTH,
  control: null,
  maskLow: 0.25,
  maskHigh: 0.6,
  heightField: null,
  focus: null,
})

const { geometry, material, uniforms, setDensity, setMaskBand, dispose } = createFlowers(props)

const setColor = (target: { value: Color }, value?: unknown) => {
  if (value !== undefined) target.value.set(new Color(value as ColorRepresentation))
}

watch(() => props.petalColor, val => setColor(uniforms.petalColor, val))
watch(() => props.petalColorB, val => setColor(uniforms.petalColorB, val))
watch(() => props.stemColor, val => setColor(uniforms.stemColor, val))
watch(() => props.centerColor, val => setColor(uniforms.centerColor, val))
watch(() => props.height, (val) => { if (val !== undefined) uniforms.height.value = val })
watch(() => props.headSize, (val) => { if (val !== undefined) uniforms.headSize.value = val })
watch(() => props.density, (val) => { setDensity(val ?? 0.55) })
// presence is fixed at creation; remount to add or remove a map
watch(() => props.densityMap, (val) => {
  if (val && uniforms.densityMap) uniforms.densityMap.value = val
})
// re-sorts and re-uploads the instance buffer; fine for a slider, not per frame
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
  <!-- a following field is never off screen; the origin-centred bounding sphere would only cull it by mistake -->
  <TresMesh
    :geometry="geometry"
    :material="material"
    :frustum-culled="!props.focus"
    :name="`Flowers:${props.shape}`"
    receive-shadow
  />
</template>
