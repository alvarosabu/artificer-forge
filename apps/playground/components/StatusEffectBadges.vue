<script setup lang="ts">
import type { StatusEffect } from '~/stores/game'

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
    <StatusEffectBadge
      v-for="effect in statusEffects"
      :key="effect.id"
      :effect-id="effect.id"
      :turns-left="effect.turnsLeft"
    />
  </div>
</template>
