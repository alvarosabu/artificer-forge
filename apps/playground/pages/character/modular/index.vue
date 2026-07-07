<script setup lang="ts">
import { PartyPanel } from '@artificer-forge/engine/ui'
import ModularExperience from './experience.vue'
useHead({ title: 'Modular Character - TresJS Playground' })
</script>

<template>
  <div>
    <GameContextProvider>
      <ModularExperience />
    </GameContextProvider>
    <GameCommandPalette />
    <PartyPanel />
  </div>
</template>
