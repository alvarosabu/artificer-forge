<script setup lang="ts">
import CombatExperience from './experience.vue'
useHead({ title: 'Damage Numbers - TresJS Playground' })
</script>

<template>
  <div>
    <Game>
      <CombatExperience />
    </Game>
    <GameCommandPalette />
    <PartyPanel />
  </div>
</template>
