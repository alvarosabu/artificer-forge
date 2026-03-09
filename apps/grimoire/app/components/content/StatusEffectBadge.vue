<script setup lang="ts">
type StatusEffectId = 'poisoned' | 'stunned' | 'burning' | 'blessed' | 'hasted' | 'frozen'

const STATUS_DEFINITIONS: Record<StatusEffectId, { label: string; icon: string; color: string; bgColor: string }> = {
  poisoned: { label: 'Poisoned', icon: 'i-lucide-skull', color: 'text-green-400', bgColor: 'bg-green-900' },
  stunned: { label: 'Stunned', icon: 'i-lucide-star', color: 'text-yellow-300', bgColor: 'bg-yellow-800' },
  burning: { label: 'Burning', icon: 'i-lucide-flame', color: 'text-orange-400', bgColor: 'bg-orange-900' },
  blessed: { label: 'Blessed', icon: 'i-lucide-sparkles', color: 'text-amber-300', bgColor: 'bg-amber-800' },
  hasted: { label: 'Hasted', icon: 'i-lucide-zap', color: 'text-blue-400', bgColor: 'bg-blue-900' },
  frozen: { label: 'Frozen', icon: 'i-lucide-snowflake', color: 'text-cyan-300', bgColor: 'bg-cyan-900' },
}

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
