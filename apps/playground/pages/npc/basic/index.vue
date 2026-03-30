<script setup lang="ts">
import NpcExperience from './experience.vue'
useHead({ title: 'Basic NPC - TresJS Playground' })
</script>

<template>
  <div>
    <Game>
      <NpcExperience />
    </Game>
    <GameCommandPalette />
    <PartyPanel />
  </div>
</template>
