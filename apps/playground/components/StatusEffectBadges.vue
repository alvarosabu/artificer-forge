<script setup lang="ts">
import type { StatusEffect } from '~/stores/game'
import { STATUS_DEFINITIONS } from '~/composables/useStatusEffects'

const props = defineProps<{
  statusEffects: StatusEffect[]
  direction?: 'row' | 'col'
}>()

const direction = computed(() => props.direction ?? 'col')
</script>

<template>
  <div
    v-if="statusEffects.length"
    class="flex gap-0.5"
    :class="direction === 'col' ? 'flex-col' : 'flex-row'"
  >
    <div
      v-for="effect in statusEffects"
      :key="effect.id"
      :title="STATUS_DEFINITIONS[effect.id].label"
      class="size-4 rounded-full flex items-center justify-center shrink-0"
      :class="STATUS_DEFINITIONS[effect.id].bgColor"
    >
      <UIcon
        :name="STATUS_DEFINITIONS[effect.id].icon"
        class="size-3"
        :class="STATUS_DEFINITIONS[effect.id].color"
      />
    </div>
  </div>
</template>
