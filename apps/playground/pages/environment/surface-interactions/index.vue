<script setup lang="ts">
import SurfaceInteractionsExperience from './experience.vue'
useHead({ title: 'Surface Interactions - Environment' })
</script>

<template>
  <div>
    <Game :camera="{ position: [10, 8, 10], lookAt: [0, 0, 0] }">
      <SurfaceInteractionsExperience />
    </Game>
    <GameCommandPalette />
    <PartyPanel />
  </div>
</template>
