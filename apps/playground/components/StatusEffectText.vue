<script setup lang="ts">
import { Html } from '@tresjs/cientos'
import { useLoop, useTresContext } from '@tresjs/core'
import { Vector3 } from 'three'
import type { StatusTextEntry } from '~/composables/useStatusEffectTexts'

const props = defineProps<{ entry: StatusTextEntry }>()
const emit = defineEmits<{ done: [] }>()

const KEYFRAMES_ID = '__status-text-rise'

onMounted(() => {
  if (document.getElementById(KEYFRAMES_ID)) return
  const style = document.createElement('style')
  style.id = KEYFRAMES_ID
  style.textContent = `
@keyframes status-text-rise {
  0%   { transform: translateY(8px); opacity: 0; }
  15%  { transform: translateY(0); opacity: 1; }
  70%  { transform: translateY(-30px); opacity: 1; }
  100% { transform: translateY(-50px); opacity: 0; }
}`
  document.head.appendChild(style)
})

// Same camera-distance compensation as DamageNumber so the label stays readable zoomed out
const BASE_FONT_SIZE = 1.0
const htmlRef = shallowRef()
const fontSize = ref(`${BASE_FONT_SIZE}rem`)
const { camera } = useTresContext()
const _worldPos = new Vector3()

const { onBeforeRender } = useLoop()
onBeforeRender(() => {
  const cam = camera.activeCamera.value
  const html = htmlRef.value?.instance
  if (!cam || !html) return

  html.getWorldPosition(_worldPos)
  const dist = cam.position.distanceTo(_worldPos)
  fontSize.value = `${BASE_FONT_SIZE * Math.max(1, dist / 15)}rem`
})
</script>

<template>
  <Html
    ref="htmlRef"
    :position="[0, 2.2, 0]"
    center
  >
    <div
      :class="entry.color"
      :style="{
        fontSize,
        fontWeight: 800,
        fontFamily: 'serif',
        pointerEvents: 'none',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        animation: 'status-text-rise 2s ease-out forwards',
        textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
      }"
      @animationend="emit('done')"
    >
      {{ entry.label }}
    </div>
  </Html>
</template>
