<script setup lang="ts">
import { onUnmounted, watch } from 'vue'
import { Color, ColorRepresentation } from 'three'
import { useLoop } from '@tresjs/core'
import { createWindLines, spawnWindLine, updateWindLines, type WindLinesOptions } from './windLines'
import { DEFAULT_WIND_ANGLE, DEFAULT_WIND_STRENGTH } from './wind'

interface WindLinesProps extends WindLinesOptions {
  intervalMin?: number
  intervalMax?: number
  translation?: number
  windAngle?: number
  intensity?: number
  originX?: number
  originZ?: number
  radius?: number
  height?: number
}

const props = withDefaults(defineProps<WindLinesProps>(), {
  count: 4,
  color: '#ffffff',
  thickness: 0.1,
  opacity: 0.35,
  length: 10,
  handlesCount: 4,
  amplitude: 1,
  divisions: 30,
  intervalMin: 0.3,
  intervalMax: 2,
  translation: 1,
  windAngle: DEFAULT_WIND_ANGLE,
  intensity: DEFAULT_WIND_STRENGTH,
  originX: 0,
  originZ: 0,
  radius: 15,
  height: 2,
})

const { lines, uniforms, dispose } = createWindLines(props)

watch(() => props.color, val => uniforms.color.value.set(new Color(val as ColorRepresentation)))
watch(() => props.thickness, (val) => { uniforms.thickness.value = val })
watch(() => props.opacity, (val) => { uniforms.opacity.value = val })

// recursive-setTimeout of the source becomes elapsed-time accumulation:
// no timer to leak on unmount, pauses with the render loop
let timer = 0
let nextInterval = props.intervalMin
const { onBeforeRender } = useLoop()
onBeforeRender(({ delta }) => {
  timer += delta
  if (timer >= nextInterval) {
    timer = 0
    nextInterval = props.intervalMin + Math.random() * (props.intervalMax - props.intervalMin)
    spawnWindLine(lines, {
      originX: props.originX,
      originZ: props.originZ,
      radius: props.radius,
      height: props.height,
      windAngle: props.windAngle,
      intensity: props.intensity,
    })
  }
  updateWindLines(lines, delta, props.translation)
})

onUnmounted(dispose)
</script>

<template>
  <TresGroup name="WindLines">
    <primitive
      v-for="(line, i) in lines"
      :key="i"
      :object="line.mesh"
    />
  </TresGroup>
</template>
