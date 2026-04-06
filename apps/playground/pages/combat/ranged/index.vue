<script setup lang="ts">
import RangedExperience from './experience.vue'
useHead({ title: 'Ranged - TresJS Playground' })
</script>

<template>
  <div>
    <Game>
      <RangedExperience />
    </Game>
    <GameCommandPalette />
    <PartyPanel />
  </div>
</template>
