<script setup lang="ts">
import FoliageExperience from './experience.vue'
useHead({ title: 'Foliage - Environment' })
</script>

<template>
  <GameContextProvider>
    <FoliageExperience />
  </GameContextProvider>
</template>
