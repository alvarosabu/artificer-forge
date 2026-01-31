<script setup lang="ts">
import type { TresRendererSetupContext } from '@tresjs/core';
import { WebGPURenderer } from 'three/webgpu';

const gameStore = useGameStore()

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
    <slot />
  </TresCanvas>
</template>