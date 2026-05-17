<script setup lang="ts">
const gameStore = useGameStore()
const inventory = useInventory()

const partyMembers = computed(() => gameStore.partyEntities)

function onPortraitClick(id: string) {
  gameStore.selectEntity(id)
  inventory.open(id)
}

function bloodFill(hp: number | undefined, maxHp: number | undefined) {
  if (!maxHp) return 0
  return Math.max(0, Math.min(100, (1 - (hp ?? 0) / maxHp) * 100))
}
</script>

<template>
  <div class="fixed left-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-50">
    <div class="flex flex-row gap-2 " v-for="member in partyMembers" :key="member.id">
    <button
   
      class="w-20 h-28 relative rounded border-2 bg-gold-600 flex flex-col items-center justify-between transition-colors cursor-pointer"
      :class="gameStore.selectedEntityId === member.id
        ? 'border-white shadow-[0_0_8px_#ffffff]'
        : 'border-gold-400/30 hover:border-gold-400/60'"
      @click="onPortraitClick(member.id)"
    >
      <img
        v-if="member.portrait"
        :src="member.portrait"
        :alt="member.name"
        class="w-full h-full object-cover rounded"
      >
      <!-- Blood fill overlay — rises from bottom as HP drops -->
      <div
        class="absolute bottom-0 left-0 right-0 pointer-events-none transition-all duration-700 ease-out rounded"
        :style="{
          height: `${bloodFill(member.hp, member.maxHp)}%`,
          background: 'linear-gradient(to top, rgba(140, 8, 8, 0.9) 0%, rgba(180, 20, 20, 0.7) 90%, rgba(200, 30, 30, 0) 100%)',
        }"
      />
      
      <span class="absolute bottom-0 left-0 right-0 text-xs text-shadow-lg/30 font-bold font-serif rounded-full px-1 py-0.5 text-white/70">
        {{ member?.hp }} / {{ member?.maxHp }}
      </span>
  
    </button>
    <!-- Status effect badges — right edge, vertical stack -->
    <StatusEffectBadges
        v-if="member.statusEffects?.length"
        :status-effects="member.statusEffects"
        direction="col"
        class=""
      />
    </div>
  </div>
</template>
