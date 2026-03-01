<script setup lang="ts">
import NpcExperience from './experience.vue'
useHead({
  title: 'Actor - TresJS Playground',
})
</script>

<template>
  <div>
    <Game>
      <NpcExperience />
    </Game>
    <GameCommandPalette />
    <PartyPanel />
  </div>
</template>
