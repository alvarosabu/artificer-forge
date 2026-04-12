<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue'
import { Html } from '@tresjs/cientos'
import { useLoop, useTresContext } from '@tresjs/core'
import { Vector3 } from 'three'
import type { DamageEntry, DamageType } from '../composables/useDamageNumbers'

const props = defineProps<{ entry: DamageEntry }>()
const emit = defineEmits<{ done: [] }>()

const KEYFRAMES_ID = '__vfx-damage-arc'

onMounted(() => {
  if (document.getElementById(KEYFRAMES_ID)) return
  const style = document.createElement('style')
  style.id = KEYFRAMES_ID
  style.textContent = `
@keyframes damage-arc {
  0%   { transform: translate(0, 0) scale(1.3); opacity: 1; }
  20%  { transform: translate(calc(var(--drift) * 15px), -20px) scale(1); opacity: 1; }
  70%  { transform: translate(calc(var(--drift) * 35px), -60px) scale(0.9); opacity: 1; }
  100% { transform: translate(calc(var(--drift) * 45px), -80px) scale(0.8); opacity: 0; }
}`
  document.head.appendChild(style)
})

const TYPE_COLORS: Record<DamageType, string> = {
  physical:  '#ef4444',
  magical:   '#a855f7',
  fire:      '#f97316',
  ice:       '#22d3ee',
  lightning: '#facc15',
  poison:    '#a3e635',
  healing:   '#22c55e',
}

const label = computed(() => {
  const prefix = props.entry.type === 'healing' ? '+' : ''
  const suffix = props.entry.critical ? '!' : ''
  return `${prefix}${props.entry.value}${suffix}`
})

const color = computed(() => TYPE_COLORS[props.entry.type])
const baseFontSize = computed(() => props.entry.critical ? 5 : 3)

// Scale font size inversely with camera distance so numbers are bigger when zoomed out
const htmlRef = shallowRef()
const fontSize = ref(`${baseFontSize.value}rem`)
const { camera } = useTresContext()
const _worldPos = new Vector3()

const { onBeforeRender } = useLoop()
onBeforeRender(() => {
  const cam = camera.value
  const html = htmlRef.value?.instance
  if (!cam || !html) return

  html.getWorldPosition(_worldPos)
  const dist = cam.position.distanceTo(_worldPos)

  const scale = Math.max(1, dist / 15)
  fontSize.value = `${baseFontSize.value * scale}rem`
})
</script>

<template>
  <Html
    ref="htmlRef"
    :position="[0, 1.5, 0]"
    center
  >
    <div
      :style="{
        '--drift': entry.drift,
        color,
        fontSize,
        fontWeight: 900,
        fontFamily: 'serif',
        pointerEvents: 'none',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        animation: 'damage-arc 2s ease-out forwards',
        textShadow: `0 0 ${entry.critical ? '14px' : '8px'} ${color}88`,
      }"
      @animationend="emit('done')"
    >
      {{ label }}
    </div>
  </Html>
</template>
