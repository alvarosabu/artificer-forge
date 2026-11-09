<script setup lang="ts">
import type { PhoneApp } from '~/utils/phoneApps'

defineProps<{
  app: PhoneApp
  highlighted: boolean
  /** The dock shows icons only. */
  label?: boolean
}>()

defineEmits<{
  hover: []
  select: []
}>()
</script>

<template>
  <div class="flex min-w-0 flex-col items-center gap-1.5">
    <div class="relative">
      <button
        type="button"
        role="menuitem"
        :aria-label="app.label"
        :class="[
          'grid size-13 place-items-center rounded-[0.9rem] bg-linear-to-b shadow-md transition-transform duration-150',
          app.tile,
          highlighted && 'scale-110 ring-3 ring-selection',
        ]"
        @pointerenter="$emit('hover')"
        @click="$emit('select')"
      >
        <UIcon :name="app.icon" class="size-7 text-white drop-shadow-sm" />
      </button>
      <PixelHand
        v-if="highlighted"
        direction="up"
        class="pointer-events-none absolute -right-4 -bottom-6 z-10 -rotate-12"
      />
    </div>
    <span
      v-if="label"
      class="max-w-full truncate text-[10px] text-default"
    >
      {{ app.label }}
    </span>
  </div>
</template>
