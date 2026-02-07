<script setup lang="ts">
import type { TresRendererSetupContext } from '@tresjs/core'
import { WebGPURenderer } from 'three/webgpu'

const { state, close, emitAction } = useContextMenuProvider()
useOutlinePassProvider()

function handlePointerMissed() {
  close()
}

function handleContextMenuAction(action: string, entityId: string) {
  emitAction(action, entityId)
}

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
    @pointer-missed="handlePointerMissed"
  >
    <slot />
    <OutlinePostProcessing
      :presets="{
        character: { visibleEdgeColor: '#ffffff', edgeThickness: 3 },
        interactive: { visibleEdgeColor: '#ffcc00', edgeThickness: 3 },
      }"
    />
  </TresCanvas>
  <EntityContextMenu
    :state="state"
    @update:open="state.open = $event"
    @action="handleContextMenuAction"
  />
</template>