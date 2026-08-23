<script setup lang="ts">
import TerrainExperience from './experience.vue'

useHead({ title: 'Terrain control map - Environment' })

// the level is 60m across, so the default character-scale camera sits inside it
const camera = {
  fov: 40,
  position: [0, 24, 48] as [number, number, number],
  target: [0, 0, 0] as [number, number, number],
  far: 400,
  maxPolarAngle: Math.PI * 80 / 180,
  minPolarAngle: Math.PI * 10 / 180,
  maxDistance: 42,
  minDistance: 8,
  follow: true,
  followHeight: 1.2,
  followSmoothing: 8,
}
</script>

<template>
  <GameContextProvider :camera="camera">
    <template #systems />
    <TerrainExperience />
  </GameContextProvider>
</template>
