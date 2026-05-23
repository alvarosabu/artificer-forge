<script setup lang="ts">
import OrcRaiderExperience from './experience.vue'
useHead({ title: 'Orc Raider - TresJS Playground' })
</script>

<template>
  <div>
    <Game>
      <OrcRaiderExperience />
    </Game>
    <GameCommandPalette />
    <PartyPanel />
  </div>
</template>
