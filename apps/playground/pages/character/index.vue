<script setup lang="ts">
import CharacterExperience from './experience.vue'
useHead({
  title: 'Character - TresJS Playground',
})
</script>

<template>
  <div>
    <Game>
      <CharacterExperience />
    </Game>
    <GameCommandPalette />
  </div>
</template>
