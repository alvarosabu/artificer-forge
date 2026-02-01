<script setup lang="ts">
import ModelExperience from './experience.vue'
useHead({
  title: 'Model - TresJS Playground',
})

</script>

<template>
  <div>
    <Game>
      <ModelExperience />
    </Game>
    <GameCommandPalette />
  </div>
</template>
