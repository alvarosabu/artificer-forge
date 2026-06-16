<script setup lang="ts">
import type { TresRendererSetupContext } from '@tresjs/core'
import { toValue } from 'vue'
import { NoToneMapping } from 'three'
import { WebGPURenderer } from 'three/webgpu'
import { EffectComposer, useOutlinePassProvider } from '@artificer-forge/post-processing'
import { CameraController, CombatSystem, SurfaceSystem, useContextMenuProvider, useGameConfig } from '../../runtime'
import {
  ActionBar,
  CharacterInventoryModal as InventoryCharacterInventoryModal,
  DialogPanel,
  EntityContextMenu,
  ItemContextMenu as InventoryItemContextMenu,
  LootPopover as InventoryLootPopover,
} from '../index'

interface CameraProps {
  position?: [number, number, number]
  lookAt?: [number, number, number]
  target?: [number, number, number]
  near?: number
  far?: number
  controls?: boolean
}

// Per-scene camera override forwarded to CameraController; omit to inherit the default.
defineProps<{ camera?: CameraProps }>()

// Render config (bloom, outline presets) — engine defaults, overridable by the app
// via provideGameConfig() above this host.
const config = useGameConfig()

const { state, close, emitAction } = useContextMenuProvider()
useOutlinePassProvider()

function handlePointerMissed() {
  close()
}

function handleContextMenuAction(action: string, entityId: string) {
  emitAction(action, entityId)
}

// WebGPU renderer is engine policy.
const createWebGPURenderer = (ctx: TresRendererSetupContext) => {
  return new WebGPURenderer({
    canvas: toValue(ctx.canvas),
    alpha: true,
    antialias: true,
  })
}
</script>

<template>
  <TresCanvas
    clear-color="#020420"
    window-size
    :renderer="createWebGPURenderer"
    :tone-mapping="NoToneMapping"
    shadows
    @pointer-missed="handlePointerMissed"
  >
    <CameraController v-bind="camera" />
    <slot />
    <CombatSystem />
    <SurfaceSystem />
    <EffectComposer
      :outline-presets="config.outlinePresets"
      :bloom="{
        strength: config.bloom.strength,
        radius: config.bloom.radius,
        threshold: config.bloom.threshold,
        smoothWidth: config.bloom.smoothWidth,
      }"
    />
  </TresCanvas>
  <EntityContextMenu
    :state="state"
    @update:open="state.open = $event"
    @action="handleContextMenuAction"
  />
  <ActionBar />
  <InventoryCharacterInventoryModal />
  <InventoryLootPopover />
  <InventoryItemContextMenu />
  <DialogPanel />
</template>
