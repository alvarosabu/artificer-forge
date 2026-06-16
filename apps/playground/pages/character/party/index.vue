<script setup lang="ts">
import { PartyPanel } from '@artificer-forge/engine/ui'
import PartyExperience from './experience.vue'

useHead({ title: 'Party - TresJS Playground' })
</script>

<template>
  <div>
    <Game>
      <PartyExperience />
    </Game>
    <GameCommandPalette />
    <PartyPanel />
  </div>
</template>
