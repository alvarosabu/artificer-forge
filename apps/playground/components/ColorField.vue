<script setup lang="ts">
import { computed } from 'vue'

// Color picker + editable R/G/B (0–255) inputs. Stores a canonical #rrggbb hex
// string (accepted directly by THREE.Color and CSS), so consumers stay simple.

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [string] }>()

const hex = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v),
})

function hexToRgb(h: string) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h.trim())
  return m
    ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) }
    : { r: 0, g: 0, b: 0 }
}

function channelHex(n: number) {
  return Math.max(0, Math.min(255, Math.round(Number(n) || 0))).toString(16).padStart(2, '0')
}

const rgb = computed(() => hexToRgb(props.modelValue))

function setChannel(ch: 'r' | 'g' | 'b', val: unknown) {
  const next = { ...rgb.value, [ch]: Number(val) }
  emit('update:modelValue', `#${channelHex(next.r)}${channelHex(next.g)}${channelHex(next.b)}`)
}
</script>

<template>
  <div class="color-field">
    <UColorPicker v-model="hex" />
    <div class="rgb-row">
      <label v-for="ch in (['r', 'g', 'b'] as const)" :key="ch" class="rgb-input">
        <span>{{ ch.toUpperCase() }}</span>
        <UInput
          type="number"
          :min="0"
          :max="255"
          size="xs"
          :model-value="rgb[ch]"
          @update:model-value="setChannel(ch, $event)"
        />
      </label>
    </div>
  </div>
</template>

<style scoped>
.color-field { display: flex; flex-direction: column; gap: 0.6rem; padding: 0.5rem; }
.rgb-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.4rem; }
.rgb-input { display: flex; flex-direction: column; gap: 0.2rem; font-size: 0.65rem; letter-spacing: 0.08em; color: #9a958a; text-transform: uppercase; }
</style>
