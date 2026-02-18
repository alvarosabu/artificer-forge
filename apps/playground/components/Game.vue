<script setup lang="ts">
import type { TresRendererSetupContext } from '@tresjs/core'
import { WebGPURenderer } from 'three/webgpu'

// Debugger

const { uuid } = useSharedLechesControls()

const { state, close, emitAction } = useContextMenuProvider()
useOutlinePassProvider()

const { playerEntity, slots, activateSlot } = useActionBar()

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

defineShortcuts({
  '1': () => activateSlot(0),
  '2': () => activateSlot(1),
  '3': () => activateSlot(2),
  '4': () => activateSlot(3),
  '5': () => activateSlot(4),
  '6': () => activateSlot(5),
  '7': () => activateSlot(6),
  '8': () => activateSlot(7),
  '9': () => activateSlot(8),
  '0': () => activateSlot(9),
})



</script>

<template>
  <TresLeches :uuid="uuid" />
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
  <ActionBar
    v-if="playerEntity"
    :player-name="playerEntity.name"
    :player-hp="playerEntity.hp ?? 0"
    :player-max-hp="playerEntity.maxHp ?? 0"
    :player-portrait="playerEntity.portrait"
    :slots="slots"
    @activate="activateSlot"
  />
</template>