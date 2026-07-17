<script setup lang="ts">
import DayCycleExperience from './experience.vue'
useHead({ title: 'Day Cycle - Environment' })
</script>

<template>
  <GameContextProvider>
    <DayCycleExperience />
  </GameContextProvider>
</template>
