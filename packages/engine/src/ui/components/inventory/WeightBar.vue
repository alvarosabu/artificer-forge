<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  current: number
  capacity: number
}>()

const ratio = computed(() => Math.min(props.current / Math.max(props.capacity, 1), 1.5))
const pct = computed(() => Math.min(ratio.value * 100, 100))

const barColor = computed(() => {
  if (ratio.value >= 1) { return 'bg-error' }
  if (ratio.value >= 0.8) { return 'bg-warning' }
  return 'bg-gold-500'
})
</script>

<template>
  <div class="w-full">
    <div class="flex justify-between text-xs text-gold-300 mb-1">
      <span>Weight</span>
      <span>{{ current.toFixed(1) }} / {{ capacity.toFixed(1) }} kg</span>
    </div>
    <div class="w-full h-2 rounded bg-leather-900 border border-leather-700/50 overflow-hidden">
      <div
        class="h-full transition-all duration-300"
        :class="[barColor]"
        :style="{ width: `${pct}%` }"
      ></div>
    </div>
  </div>
</template>
