<script setup lang="ts">
import CharacterExperience from './experience.vue'
useHead({ title: 'Basic Character - TresJS Playground' })
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
