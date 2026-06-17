<script setup lang="ts">
import { PartyPanel } from '@artificer-forge/engine/ui'
import CharacterExperience from './experience.vue'
useHead({ title: 'Basic Character - TresJS Playground' })
</script>

<template>
  <div>
    <GameContextProvider>
      <template #camera>
        <TresPerspectiveCamera :position="[0,0,1]" :near="0.1" :far="100" />
      </template>
      <CharacterExperience />
    </GameContextProvider>
    <GameCommandPalette />
    <PartyPanel />
  </div>
</template>
