<script setup lang="ts">
import { PartyPanel } from '@artificer-forge/engine/ui'
import PartyExperience from './experience.vue'

useHead({ title: 'Party - TresJS Playground' })
</script>

<template>
  <div>
    <GameContextProvider>
      <PartyExperience />
    </GameContextProvider>
    <GameCommandPalette />
    <PartyPanel />
  </div>
</template>
