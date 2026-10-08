<script setup lang="ts">
import { onUnmounted, watch } from 'vue'
import { Color, type ColorRepresentation } from 'three'
import { useLoop } from '@tresjs/core'
import { createPalmFronds, type PalmFrondsOptions } from './palmFronds'
import { advanceWindTime, DEFAULT_WIND_ANGLE, DEFAULT_WIND_STRENGTH } from '../wind/wind'

const props = withDefaults(defineProps<PalmFrondsOptions>(), {
  references: () => [],
  fronds: 16,
  youngFronds: 3,
  segments: 10,
  leaflets: 14,
  leafletAngle: 0.55,
  leafletHang: 0.35,
  leafletLength: 0.32,
  leafletWidth: 0.16,
  droop: 1.1,
  colorA: '#5f7d2c',
  colorB: '#a9c45a',
  seed: 'palms',
  windAngle: DEFAULT_WIND_ANGLE,
  windStrength: DEFAULT_WIND_STRENGTH,
  grading: null,
})

const { geometry, material, count, uniforms, dispose } = createPalmFronds(props)

watch(() => props.colorA, (val) => { if (val !== undefined) uniforms.colorA.value.set(new Color(val as ColorRepresentation)) })
watch(() => props.colorB, (val) => { if (val !== undefined) uniforms.colorB.value.set(new Color(val as ColorRepresentation)) })
watch(() => props.windAngle, (angle) => uniforms.wind.direction.value.set(Math.sin(angle), Math.cos(angle)))
watch(() => props.windStrength, (val) => { uniforms.wind.strength.value = val })

const { onBeforeRender } = useLoop()
onBeforeRender(({ delta }) => advanceWindTime(uniforms.wind, delta))

onUnmounted(dispose)
</script>

<template>
  <!-- the template bounds sit at the origin; the crowns are spread by the instance matrices -->
  <TresInstancedMesh
    :args="[geometry, material, count]"
    name="PalmFronds"
    cast-shadow
    receive-shadow
    :frustum-culled="false"
  />
</template>
