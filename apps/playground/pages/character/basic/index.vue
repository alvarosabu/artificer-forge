<script setup lang="ts">
import { PartyPanel } from '@artificer-forge/engine/ui'
import CharacterExperience from './experience.vue'
useHead({ title: 'Basic Character - TresJS Playground' })
</script>

<template>
  <div>
    <GameContextProvider>
      <CharacterExperience />
    </GameContextProvider>
    <GameCommandPalette />
    <PartyPanel />
  </div>
</template>
