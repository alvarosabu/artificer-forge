<script setup lang="ts">
import { createWebGPURenderer, Floor } from '@artificer-forge/engine/runtime'
import { TresLeches, useControls } from '@tresjs/leches'
import { PCFShadowMap } from 'three'

useHead({
  title: 'Game Concept',
  meta: [
    { name: 'description', content: 'A TresJS Nuxt application' }
  ]
})

const uuid = 'game-canvas'
provide('uuid', uuid)

// Chamo writes this as it moves and the camera follows it.
const playerPosition = ref<[number, number, number]>([0, 0, 0])

useControls('fpsgraph', {
  uuid
})
</script>

<template>
  <TresLeches :uuid="uuid"/>
  <TresCanvas
    window-size
    shadows
    :shadow-map-type="PCFShadowMap"
    :renderer="createWebGPURenderer"
  >
    <CameraController :target="playerPosition" />
    <EnvironmentController v-slot="{ grading }">
      <Chamo v-model:position="playerPosition" />
      <Floor :grading="grading" />
    </EnvironmentController>
  </TresCanvas>
</template>