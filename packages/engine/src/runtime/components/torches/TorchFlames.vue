<script setup lang="ts">
import { onUnmounted, watch } from 'vue'
import { Color, type ColorRepresentation } from 'three'
import { useLoop } from '@tresjs/core'
import { createTorchFlames, type TorchFlamesOptions } from './torchFlames'
import { advanceWindTime, DEFAULT_WIND_ANGLE, DEFAULT_WIND_STRENGTH } from '../wind/wind'

const props = withDefaults(defineProps<TorchFlamesOptions>(), {
  references: () => [],
  windAngle: DEFAULT_WIND_ANGLE,
  windStrength: DEFAULT_WIND_STRENGTH,
  grading: null,
})

const { group, uniforms, setLight, dispose } = createTorchFlames(props)

const setColor = (target: { value: Color }, value?: unknown) => {
  if (value !== undefined) target.value.set(new Color(value as ColorRepresentation))
}
const setScalar = (target: { value: number }, value?: number) => {
  if (value !== undefined) target.value = value
}

watch(() => props.riseSpeed, val => setScalar(uniforms.riseSpeed, val))
watch(() => props.displaceStrength, val => setScalar(uniforms.displaceStrength, val))
watch(() => props.flicker, val => setScalar(uniforms.flicker, val))
watch(() => props.windLean, val => setScalar(uniforms.windLean, val))
watch(() => props.emission, val => setScalar(uniforms.emission, val))
watch(() => props.glowIntensity, val => setScalar(uniforms.glowIntensity, val))
watch(() => props.lightColor, color => setLight({ color }))
watch(() => props.lightIntensity, intensity => setLight({ intensity }))
watch(() => props.lightRadius, radius => setLight({ radius }))
watch(() => props.lightFlicker, flicker => setLight({ flicker }))
watch(() => props.coreStrength, val => setScalar(uniforms.coreStrength, val))
watch(() => props.rimStrength, val => setScalar(uniforms.rimStrength, val))
watch(() => props.coreLow, val => setColor(uniforms.coreLow, val))
watch(() => props.coreMid, val => setColor(uniforms.coreMid, val))
watch(() => props.coreHigh, val => setColor(uniforms.coreHigh, val))
watch(() => props.rimLow, val => setColor(uniforms.rimLow, val))
watch(() => props.rimHigh, val => setColor(uniforms.rimHigh, val))
watch(() => props.emberSize, val => setScalar(uniforms.emberSize, val))
watch(() => props.emberRise, val => setScalar(uniforms.emberRise, val))
watch(() => props.emberDrift, val => setScalar(uniforms.emberDrift, val))
watch(() => props.windAngle, angle => uniforms.wind.direction.value.set(Math.sin(angle), Math.cos(angle)))
watch(() => props.windStrength, (val) => { uniforms.wind.strength.value = val })

const { onBeforeRender } = useLoop()
onBeforeRender(({ delta }) => advanceWindTime(uniforms.wind, delta))

onUnmounted(dispose)
</script>

<template>
  <primitive :object="group" />
</template>
