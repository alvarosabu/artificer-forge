<script setup lang="ts">
import AttackExperience from './experience.vue'
useHead({ title: 'Attack - TresJS Playground' })
</script>

<template>
  <div>
    <Game>
      <AttackExperience />
    </Game>
    <GameCommandPalette />
    <PartyPanel />
  </div>
</template>
