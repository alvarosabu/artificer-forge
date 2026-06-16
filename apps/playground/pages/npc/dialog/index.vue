<script setup lang="ts">
import { PartyPanel } from '@artificer-forge/engine/ui'
import DialogExperience from './experience.vue'
useHead({ title: 'Dialog NPC - TresJS Playground' })
</script>

<template>
  <div>
    <Game>
      <DialogExperience />
    </Game>
    <GameCommandPalette />
    <PartyPanel />
  </div>
</template>
