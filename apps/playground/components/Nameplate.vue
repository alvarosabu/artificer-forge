<script setup lang="ts">
import type { StatusEffect, Team } from '~/stores/game'

const props = defineProps<{
  name: string
  team?: Team
  level?: number
  race?: string
  hp?: number
  maxHp?: number
  statusEffects?: StatusEffect[]
}>()

const isDead = computed(() => props.hp != null && props.hp <= 0)

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
  <div class="flex flex-col items-center gap-1 w-[150px] text-center font-serif">
    <span class="text-lg text-shadow-lg font-bold flex items-center justify-center gap-1" :class="nameColor">
      <UIcon v-if="isDead" name="ph:skull-fill" class="size-4 text-neutral-300 drop-shadow-[0_0_2px_#737373]" />
      <UIcon v-else-if="team === 'hostile'" name="ph:skull-fill" class="size-4 text-white drop-shadow-[0_0_2px_#dc2626]" />
      {{ isDead ? 'Dead' : name }}
    </span>
    <p v-if="level || race" class="text-sm text-white/70 font-bold flex items-center justify-center gap-1">
      <span v-if="level">Lv. {{ level }}</span>
      <span v-if="race">{{ race }}</span>
    </p>
    <StatusEffectBadges
      v-if="statusEffects?.length"
      :status-effects="statusEffects"
      direction="row"
      class="mt-0.5"
    />
    <UProgress
      size="lg"
      :ui="{ base: 'bg-black' }"
      class="border border-3 border-black rounded-full"
      color="error"
      :model-value="hp"
      :max="maxHp"
    />
    <span class="-mt-[8px] text-xs text-shadow-lg/30 font-bold bg-black rounded-full px-1 py-0.5" :class="nameColor">{{ hp }} / {{ maxHp }}</span>
  </div>
</template>
