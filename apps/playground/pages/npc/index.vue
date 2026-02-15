<script setup lang="ts">
import NpcExperience from './experience.vue'
useHead({
  title: 'NPC - TresJS Playground',
})
</script>

<template>
  <div>
    <Game>
      <NpcExperience />
    </Game>
    <GameCommandPalette />
  </div>
</template>
