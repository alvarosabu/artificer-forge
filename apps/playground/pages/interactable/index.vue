<script setup lang="ts">
import InteractableExperience from './experience.vue'
useHead({
  title: 'Interactable - TresJS Playground',
})
</script>

<template>
  <div>
    <Game>
      <InteractableExperience />
    </Game>
    <GameCommandPalette />
  </div>
</template>
