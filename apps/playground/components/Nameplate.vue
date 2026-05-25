<script setup lang="ts">
import type { StatusEffect, Team } from '~/stores/game'

const props = defineProps<{
  name: string
  team?: Team
  level?: number
  race?: string
  hp?: number
  maxHp?: number
  physicalArmor?: number
  maxPhysicalArmor?: number
  magicalArmor?: number
  maxMagicalArmor?: number
  statusEffects?: StatusEffect[]
}>()

const isDead = computed(() => props.hp != null && props.hp <= 0)

const hasArmor = computed(() =>
  (props.maxPhysicalArmor ?? 0) > 0 || (props.maxMagicalArmor ?? 0) > 0,
)

const nameColor = computed(() => {
  if (isDead.value) return 'text-neutral-400'
  switch (props.team) {
    case 'hostile': return 'text-red-400'
    case 'player': return 'text-cyan-300'
    default: return 'text-white'
  }
})

</script>

<template>
  <div class="flex flex-col items-center  w-[150px] text-center font-serif">
    <span class="text-lg text-shadow-lg font-bold flex items-center justify-center gap-1 mb-1" :class="nameColor">
      <UIcon v-if="isDead" name="ph:skull-fill" class="size-4 text-neutral-300 drop-shadow-[0_0_2px_#737373]" />
      <UIcon v-else-if="team === 'hostile'" name="ph:skull-fill" class="size-4 text-white drop-shadow-[0_0_2px_#dc2626]" />
      {{ isDead ? 'Dead' : name }}
    </span>
    <p v-if="level || race" class="text-sm text-white/70 font-bold flex items-center justify-center gap-1 mb-1">
      <span v-if="level">Lv. {{ level }}</span>
      <span v-if="race">{{ race }}</span>
    </p>
    <StatusEffectBadges
      v-if="statusEffects?.length"
      :status-effects="statusEffects"
      direction="row"
      class="mt-0.5"
    />
    <div v-if="!isDead && hasArmor" class="flex items-center justify-between gap-1 w-full">
       <div class="flex items-center justify-start gap-1  bg-black rounded-full px-1 py-0.5">
        <UIcon name="ph:shield-fill" class="size-3 text-white" />
        <span class="text-xs font-bold text-white">{{ physicalArmor }} / {{ maxPhysicalArmor }}</span>
       </div>
       <div class="flex items-center justify-start gap-1  flex-row-reverse bg-black rounded-full px-1 py-0.5">
        <UIcon name="ph:shield-star-fill" class="size-3 text-blue-400" />
        <span class="text-xs font-bold text-blue-400">{{ magicalArmor }} / {{ maxMagicalArmor }}</span>
       </div>
    </div>
    <div v-if="!isDead && hasArmor" class="flex items-center w-full bg-black rounded-full py-0.5">
      <UProgress
        size="sm"
        :ui="{ base: 'bg-black rounded-none', indicator: 'bg-white ' }"
        :model-value="physicalArmor"
        :max="maxPhysicalArmor"
      />
      <UProgress
        size="sm"
        :ui="{ base: 'bg-black rounded-none' }"
        color="secondary"
        :model-value="magicalArmor"
        :max="maxMagicalArmor"
      />
    </div>
    <UProgress
      size="sm"
      :ui="{ base: 'bg-black rounded-none' }"
      color="error"
      :model-value="hp"
      :max="maxHp"
    />
    <span class="text-xs text-shadow-lg/30 font-bold bg-black rounded-full px-1 py-0.5 flex items-center justify-center gap-1" :class="nameColor"> <UIcon name="ph:heart-fill" class="size-3 text-red-400" /> {{ hp }} / {{ maxHp }}</span>
  </div>
</template>
