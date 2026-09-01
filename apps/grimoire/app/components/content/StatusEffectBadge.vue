<script setup lang="ts">
// Mirrors apps/playground/content/status-effects/*.yaml. The grimoire has no Pinia
// store, so the definitions are inlined here. Keep icon/colors in sync with the YAML.
// `encumbered` has no YAML file; its values come from the runtime fallback table.
type StatusEffectId =
  | 'poisoned'
  | 'shocked'
  | 'burning'
  | 'blessed'
  | 'hasted'
  | 'frozen'
  | 'wet'
  | 'slowed'
  | 'warm'
  | 'encumbered'

const STATUS_DEFINITIONS: Record<StatusEffectId, { label: string; icon: string; color: string; bgColor: string }> = {
  poisoned: { label: 'Poisoned', icon: 'i-lucide-skull', color: 'text-green-400', bgColor: 'bg-green-900' },
  shocked: { label: 'Shocked', icon: 'i-lucide-zap', color: 'text-cyan-400', bgColor: 'bg-cyan-950' },
  burning: { label: 'Burning', icon: 'i-lucide-flame', color: 'text-orange-400', bgColor: 'bg-orange-900' },
  blessed: { label: 'Blessed', icon: 'i-lucide-sparkles', color: 'text-amber-300', bgColor: 'bg-amber-800' },
  hasted: { label: 'Hasted', icon: 'i-lucide-zap', color: 'text-blue-400', bgColor: 'bg-blue-900' },
  frozen: { label: 'Frozen', icon: 'i-lucide-snowflake', color: 'text-cyan-300', bgColor: 'bg-cyan-900' },
  wet: { label: 'Wet', icon: 'i-lucide-droplets', color: 'text-sky-300', bgColor: 'bg-sky-900' },
  slowed: { label: 'Slowed', icon: 'i-lucide-snail', color: 'text-amber-400', bgColor: 'bg-amber-900' },
  warm: { label: 'Warm', icon: 'i-lucide-thermometer-sun', color: 'text-orange-300', bgColor: 'bg-orange-950' },
  encumbered: { label: 'Encumbered', icon: 'i-lucide-weight', color: 'text-stone-300', bgColor: 'bg-stone-800' },
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
