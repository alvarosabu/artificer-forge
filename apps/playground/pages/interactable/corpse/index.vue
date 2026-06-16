<script setup lang="ts">
import { PartyPanel } from '@artificer-forge/engine/ui'
import OrcRaiderExperience from './experience.vue'
useHead({ title: 'Orc Raider - TresJS Playground' })
</script>

<template>
  <div>
    <GameContextProvider>
      <OrcRaiderExperience />
    </GameContextProvider>
    <GameCommandPalette />
    <PartyPanel />
  </div>
</template>
