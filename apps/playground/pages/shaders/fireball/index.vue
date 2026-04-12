<script setup lang="ts">
import type { TresRendererSetupContext } from '@tresjs/core'
import { WebGPURenderer } from 'three/webgpu'

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
  <TresLeches />
  <TresCanvas window-size :renderer="createWebGPURenderer" clear-color="#020420">
    <ShadersFireballExperience />
  </TresCanvas>
</template>
