<script setup lang="ts">
const gameStore = useGameStore()

const partyMembers = computed(() => gameStore.partyEntities)

function selectMember(id: string) {
  gameStore.selectEntity(id)
}
</script>

<template>
  <div class="fixed left-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-50">
    <button
      v-for="member in partyMembers"
      :key="member.id"
      class="w-16 h-20 rounded border-2 bg-black/70 flex flex-col items-center justify-between p-1 transition-colors cursor-pointer"
      :class="gameStore.selectedEntityId === member.id
        ? 'border-cyan-400 shadow-[0_0_8px_#00e5ff]'
        : 'border-white/30 hover:border-white/60'"
      @click="selectMember(member.id)"
    >
      <img
        v-if="member.portrait"
        :src="member.portrait"
        :alt="member.name"
        class="w-12 h-12 object-cover rounded"
      >
      <div
        v-else
        class="w-12 h-12 rounded bg-white/10 flex items-center justify-center text-white/40 text-xs"
      >
        ?
      </div>
      <UProgress
        size="xs"
        color="success"
        class="w-full"
        :model-value="member.hp ?? 0"
        :max="member.maxHp ?? 1"
      />
    </button>
  </div>
</template>
