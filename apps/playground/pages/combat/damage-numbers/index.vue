<script setup lang="ts">
import { PartyPanel } from '@artificer-forge/engine/ui'
import CombatExperience from './experience.vue'
useHead({ title: 'Damage Numbers - TresJS Playground' })
</script>

<template>
  <div>
    <GameContextProvider>
      <CombatExperience />
    </GameContextProvider>
    <GameCommandPalette />
    <PartyPanel />
  </div>
</template>
