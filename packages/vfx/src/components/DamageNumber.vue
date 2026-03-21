<script setup lang="ts">
import { computed } from 'vue'
import { Html } from '@tresjs/cientos'
import type { DamageEntry, DamageType } from '../composables/useDamageNumbers'

const props = defineProps<{ entry: DamageEntry }>()
const emit = defineEmits<{ done: [] }>()

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
const fontSize = computed(() => props.entry.critical ? '1.5rem' : '1rem')
</script>

<template>
  <Html
    :position="[0, 1.5, 0]"
    center
    :distance-factor="10"
  >
    <div
      class="font-black font-serif pointer-events-none select-none whitespace-nowrap animate-damage-arc"
      :style="{
        '--drift': entry.drift,
        color,
        fontSize,
        textShadow: `0 0 ${entry.critical ? '14px' : '8px'} ${color}88`,
      }"
      @animationend="emit('done')"
    >
      {{ label }}
    </div>
  </Html>
</template>
