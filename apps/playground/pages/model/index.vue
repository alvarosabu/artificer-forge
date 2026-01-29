<script setup lang="ts">
import { WebGPURenderer } from 'three/webgpu'
import type { TresRendererSetupContext } from '@tresjs/core'
import ModelExperience from './experience.vue'
useHead({
  title: 'Model - TresJS Playground',
})

const createWebGPURenderer = (ctx: TresRendererSetupContext) => {
  const renderer = new WebGPURenderer({
    canvas: toValue(ctx.canvas),
    alpha: true,
    antialias: true,
  })
  return renderer
}
</script>

<template>
  <TresCanvas
    clear-color="#020420"
    window-size
    :renderer="createWebGPURenderer"
  >
    <ModelExperience />
  </TresCanvas>
</template>
