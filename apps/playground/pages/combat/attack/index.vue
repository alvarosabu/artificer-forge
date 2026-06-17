<script setup lang="ts">
import { PartyPanel } from '@artificer-forge/engine/ui'
import AttackExperience from './experience.vue'
useHead({ title: 'Attack - TresJS Playground' })
</script>

<template>
  <div>
    <GameContextProvider>
      <AttackExperience />
    </GameContextProvider>
    <GameCommandPalette />
    <PartyPanel />
  </div>
</template>
