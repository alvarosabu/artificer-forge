<script setup lang="ts">
import { PartyPanel } from '@artificer-forge/engine/ui'
import NpcExperience from './experience.vue'
useHead({ title: 'Basic NPC - TresJS Playground' })
</script>

<template>
  <div>
    <Game>
      <NpcExperience />
    </Game>
    <GameCommandPalette />
    <PartyPanel />
  </div>
</template>
