<script setup lang="ts">
// Page metadata
useHead({
  title: 'TresJS Nuxt - {{projectName}}',
  meta: [
    { name: 'description', content: 'A TresJS Nuxt application' }
  ]
})
</script>

<template>
  <TresCanvas
    clear-color="#020420"
    window-size
  >
    <TheExperience />
  </TresCanvas>
</template>