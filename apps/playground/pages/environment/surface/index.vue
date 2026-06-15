<script setup lang="ts">
import SurfaceExperience from './experience.vue'
useHead({ title: 'Surface - Environment' })

const uuid = 'surface-environment'

useControls('fpsgraph', {
  uuid
})

provide('unique-uuid', uuid)
</script>

<template>
  <Game>
    <template #controls>
      <TresLeches :uuid="uuid" />  <!-- own panel: expanded, or different uuid entirely -->
    </template>
    <SurfaceExperience />
  </Game>
</template>
