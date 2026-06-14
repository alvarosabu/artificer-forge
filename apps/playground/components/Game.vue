<script setup lang="ts">
import type { TresRendererSetupContext } from '@tresjs/core'
import { useControls } from '@tresjs/leches'
import { ACESFilmicToneMapping, AgXToneMapping, CineonToneMapping, LinearToneMapping, NeutralToneMapping, NoToneMapping, ReinhardToneMapping } from 'three'
import { WebGPURenderer } from 'three/webgpu'
import { useOutlinePassProvider, EffectComposer } from '@artificer-forge/post-processing'

// Debugger

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

const { uuid } = useSharedLechesControls()

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

const { toneMapping } = useControls('toneMapping', {
  toneMapping: {
    value: ACESFilmicToneMapping,
    options: [
      { text: 'No Tone Mapping', value: NoToneMapping },
      { text: 'Linear', value: LinearToneMapping },
      { text: 'Reinhard', value: ReinhardToneMapping },
      { text: 'Cineon', value: CineonToneMapping },
      { text: 'ACES Filmic', value: ACESFilmicToneMapping },
      { text: 'AgX', value: AgXToneMapping }, // New in Three.js r155
      { text: 'Neutral', value: NeutralToneMapping },
    ],
  },
}, {uuid})

const { postprocessingBloomStrength, postprocessingBloomThreshold, postprocessingBloomRadius, postprocessingBloomSmoothWidth } = useControls('postprocessing', {
  bloomStrength: {
    value: 0.7,
    min: 0,
    max: 3,
    step: 0.01,
    type: 'range',
  },
  bloomRadius: {
    value: 0.4,
    min: 0,
    max: 1,
    step: 0.01,
    type: 'range',
  },
  bloomThreshold: {
    value: 0.8,
    min: 0,
    max: 1,
    step: 0.01,
    type: 'range',
  },
  bloomSmoothWidth: {
    value: 0.3,
    min: 0,
    max: 1,
    step: 0.01,
    type: 'range',
  },
}, {uuid})

</script>

<template>
  <slot name="controls" :uuid="uuid">
    <TresLeches :uuid="uuid" collapsed />
  </slot>
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
      :outline-presets="{
        party: { visibleEdgeColor: '#00e5ff', edgeThickness: 3 },
        interactive: { visibleEdgeColor: '#ffcc00', edgeThickness: 3 },
        hostile: { visibleEdgeColor: '#ff4444', edgeThickness: 3 },
        neutral: { visibleEdgeColor: '#ffffff', edgeThickness: 3 },
        ally: { visibleEdgeColor: '#00e5ff', edgeThickness: 3 },
      }"
      :bloom="{
        strength: postprocessingBloomStrength,
        radius: postprocessingBloomRadius,
        threshold: postprocessingBloomThreshold,
        smoothWidth: postprocessingBloomSmoothWidth,
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
