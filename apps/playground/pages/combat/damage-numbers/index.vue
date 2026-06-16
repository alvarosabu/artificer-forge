<script setup lang="ts">
import { PartyPanel } from '@artificer-forge/engine/ui'
import CombatExperience from './experience.vue'
useHead({ title: 'Damage Numbers - TresJS Playground' })
</script>

<template>
  <div>
    <Game>
      <CombatExperience />
    </Game>
    <GameCommandPalette />
    <PartyPanel />
  </div>
</template>
