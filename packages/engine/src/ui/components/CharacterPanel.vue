<script setup lang="ts">
import { computed } from 'vue'
import { type EntityState, StatusEffectBadges, useGameStore, useInventory, usePortraitRenderer } from '@artificer-forge/engine/runtime'

const props = defineProps<{
  member: EntityState
}>()

const gameStore = useGameStore()
const inventory = useInventory()

// Live-baked render (same source as the ActionBar portrait), falling back to the
// authored template portrait while it renders or if the bake fails.
const { url: portrait } = usePortraitRenderer(() => props.member.id)

const isSelected = computed(() => gameStore.selectedEntityId === props.member.id)
const isDead = computed(() => (props.member.hp ?? 1) <= 0)
const maxArmor = computed(() => gameStore.derivedMaxArmor(props.member.id))
const hasArmor = computed(() => maxArmor.value.physical > 0 || maxArmor.value.magical > 0)

const bloodFillPercent = computed(() => {
  const { hp, maxHp } = props.member
  if (!maxHp) return 0
  return Math.max(0, Math.min(100, (1 - (hp ?? 0) / maxHp) * 100))
})

function handleClick() {
  gameStore.selectEntity(props.member.id)
  inventory.open(props.member.id)
}
</script>

<template>
  <div class="flex flex-row gap-2">
    <button
      class="w-20 h-28 relative rounded border-2 bg-gold-600 flex flex-col items-center justify-between transition-colors cursor-pointer"
      :class="isSelected
        ? 'border-white shadow-[0_0_8px_#ffffff]'
        : 'border-gold-400/30 hover:border-gold-400/60'"
      @click="handleClick"
    >
      <img
        v-if="portrait"
        :src="portrait"
        :alt="member.name"
        class="w-full h-full object-cover rounded"
      >
      <div
        class="absolute bottom-0 left-0 right-0 pointer-events-none transition-all duration-700 ease-out rounded"
        :style="{
          height: `${bloodFillPercent}%`,
          background: 'linear-gradient(to top, rgba(140, 8, 8, 0.9) 0%, rgba(180, 20, 20, 0.7) 90%, rgba(200, 30, 30, 0) 100%)',
        }"
      />
      <div class="absolute bottom-0 left-0 right-0 flex flex-col items-center w-full px-0.5 pb-0.5">
        <span class="text-xs text-shadow-lg/30 font-bold font-serif rounded-full px-1 text-white/70">
          {{ member.hp }} / {{ member.maxHp }}
        </span>
        <UProgress
          size="sm"
          :ui="{ base: 'bg-black border h-1.5 border-black rounded-none' }"
          color="error"
          :model-value="member.hp"
          :max="member.maxHp"
        />
        <div v-if="!isDead && hasArmor" class="flex items-center w-full bg-black rounded-full overflow-hidden">
          <UProgress
            size="sm"
            :ui="{ base: 'bg-black border h-1.5 border-black rounded-none', indicator: 'bg-white' }"
            :model-value="member.physicalArmor"
            :max="maxArmor.physical"
          />
          <UProgress
            size="sm"
            :ui="{ base: 'bg-black border h-1.5 border-black rounded-none' }"
            color="secondary"
            :model-value="member.magicalArmor"
            :max="maxArmor.magical"
          />
        </div>
      </div>
    </button>
    <StatusEffectBadges
      v-if="member.statusEffects?.length"
      :status-effects="member.statusEffects"
      direction="col"
    />
  </div>
</template>