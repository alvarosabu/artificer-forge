<script setup lang="ts">
import { PartyPanel } from '@artificer-forge/engine/ui'
import DialogExperience from './experience.vue'
useHead({ title: 'Dialog NPC - TresJS Playground' })
</script>

<template>
  <div>
    <GameContextProvider>
      <DialogExperience />
    </GameContextProvider>
    <GameCommandPalette />
    <PartyPanel />
  </div>
</template>
