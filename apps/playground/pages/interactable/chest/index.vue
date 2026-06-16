<script setup lang="ts">
import { PartyPanel } from '@artificer-forge/engine/ui'
import InteractableExperience from './experience.vue'
useHead({ title: 'Chest - TresJS Playground' })
</script>

<template>
  <div>
    <Game>
      <InteractableExperience />
    </Game>
    <GameCommandPalette />
    <PartyPanel />
  </div>
</template>
