<script setup lang="ts">
const gameStore = useGameStore()

const partyMembers = computed(() => gameStore.partyEntities)
</script>

<template>
  <div class="fixed left-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-50">
    <CharacterPanel
      v-for="member in partyMembers"
      :key="member.id"
      :member="member"
    />
  </div>
</template>
