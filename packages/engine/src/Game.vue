<script setup lang="ts">
// Engine composition root — sits above the /core, /runtime and /ui layers.
// Owns the canvas + renderer + camera + in-scene systems (runtime) and mounts
// the HUD overlay (ui). Renderer and post-processing are engine policy; render
// config (bloom, outline presets) comes from useGameConfig().
import type { TresRendererSetupContext } from '@tresjs/core'
import { toValue } from 'vue'
import { NoToneMapping } from 'three'
import { WebGPURenderer } from 'three/webgpu'
import { EffectComposer, useOutlinePassProvider } from '@artificer-forge/post-processing'
import { CameraController, CombatSystem, SurfaceSystem, useContextMenuProvider, useGameConfig } from '@artificer-forge/engine/runtime'
import { Hud } from '@artificer-forge/engine/ui'

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

const config = useGameConfig()

// Set up the context-menu provider here so both the canvas (pointer-missed) and
// the HUD (which injects it) share one instance.
const { close } = useContextMenuProvider()
useOutlinePassProvider()

function handlePointerMissed() {
  close()
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
  <Hud />
</template>
