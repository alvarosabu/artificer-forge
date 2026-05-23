<script setup lang="ts">
import InteractableExperience from './experience.vue'
useHead({ title: 'Chest - TresJS Playground' })
</script>

<template>
  <div>
    <Game>
      <InteractableExperience />
    </Game>
    <GameCommandPalette />
    <PartyPanel />
  </div>
</template>
