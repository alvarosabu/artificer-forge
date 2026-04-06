<script setup lang="ts">
import CharacterExperience from './experience.vue'
useHead({ title: 'Large Character - TresJS Playground' })
</script>

<template>
  <div>
    <Game>
      <CharacterExperience />
    </Game>
    <GameCommandPalette />
    <PartyPanel />
  </div>
</template>
