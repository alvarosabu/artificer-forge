<script setup lang="ts">
import { PartyPanel } from '@artificer-forge/engine/ui'
import RangedExperience from './experience.vue'
useHead({ title: 'Ranged - TresJS Playground' })
</script>

<template>
  <div>
    <Game>
      <RangedExperience />
    </Game>
    <GameCommandPalette />
    <PartyPanel />
  </div>
</template>
