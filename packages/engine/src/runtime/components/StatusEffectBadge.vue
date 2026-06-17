<script setup lang="ts">
import { computed } from 'vue'
import type { StatusEffectId } from '@artificer-forge/engine/core'
import { useStatusEffectStore } from '../stores/statusEffects'

const props = defineProps<{
  effectId: StatusEffectId
  turnsLeft?: number
}>()

const store = useStatusEffectStore()
const def = computed(() => store.get(props.effectId))
</script>

<template>
  <UTooltip :text="def?.label">
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
        :class="def?.bgColor"
      >
        <UIcon :name="def?.icon ?? ''" size="size" :class="def?.color" />
      </div>
    </UChip>
  </UTooltip>
</template>
