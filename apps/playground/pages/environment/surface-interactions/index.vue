<script setup lang="ts">
import { PartyPanel } from '@artificer-forge/engine/ui'
import SurfaceInteractionsExperience from './experience.vue'
useHead({ title: 'Surface Interactions - Environment' })
</script>

<template>
  <div>
    <Game :camera="{ position: [10, 8, 10], lookAt: [0, 0, 0] }">
      <Suspense>
        <SurfaceInteractionsExperience />
      </Suspense>
    </Game>
    <GameCommandPalette />
    <PartyPanel />
  </div>
</template>
