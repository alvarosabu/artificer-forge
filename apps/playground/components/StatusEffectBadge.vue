<script setup lang="ts">
import type { StatusEffectId } from '~/stores/game'
import { STATUS_DEFINITIONS } from '~/composables/useStatusEffects'

const props = defineProps<{
  effectId: StatusEffectId
  turnsLeft?: number
}>()

const def = computed(() => STATUS_DEFINITIONS[props.effectId])
</script>

<template>
  <UTooltip :text="def.label">
    <UChip
      :show="props.turnsLeft !== undefined"
      :text="turnsLeft"
      size="3xs"
      color="neutral"
      position="bottom-right"
      inset
    >
      <div
        class="size-4 rounded-full flex items-center justify-center shrink-0 cursor-pointer"
        :class="def.bgColor"
      >
        <UIcon :name="def.icon" size="size" :class="def.color" />
      </div>
    </UChip>
  </UTooltip>
</template>
