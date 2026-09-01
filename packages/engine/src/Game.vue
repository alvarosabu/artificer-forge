<script setup lang="ts">
import { NoToneMapping } from 'three'
import { EffectComposer, useDofFocusProvider, useOutlinePassProvider } from '@artificer-forge/post-processing'
import { CameraController, CombatSystem, SurfaceSystem, createWebGPURenderer, useContextMenuProvider, useGameConfig } from '@artificer-forge/engine/runtime'
import type { CameraProps } from '@artificer-forge/engine/runtime'
import { Hud } from '@artificer-forge/engine/ui'

// Ignored when the #camera slot is overridden.
defineProps<{ camera?: CameraProps }>()

const config = useGameConfig()

// Provided here so the canvas (pointer-missed) and the HUD share one instance.
const { close } = useContextMenuProvider()
useOutlinePassProvider()
useDofFocusProvider()

function handlePointerMissed() {
  close()
}

</script>

<template>
  <!-- dpr is a [min, max] clamp. Every post pass pays the pixel multiplier; 1.5 is
       where flat colour fields and cutout foliage stop showing the difference. -->
  <TresCanvas
    clear-color="#020420"
    window-size
    :dpr="[1, 1.5]"
    :renderer="createWebGPURenderer"
    :tone-mapping="NoToneMapping"
    shadows
    @pointer-missed="handlePointerMissed"
  >
    <slot name="camera">
      <CameraController v-bind="camera" />
    </slot>
    <slot />
    <!-- Keyed on slot presence, not output: <slot> falls back whenever the provided
         slot renders nothing, so an empty #systems would get the defaults and
         CombatSystem's ground-click plane would quietly outrank a scene's terrain. -->
    <slot v-if="$slots.systems" name="systems" />
    <template v-else>
      <CombatSystem />
      <SurfaceSystem />
    </template>
    <EffectComposer
      :outline-presets="config.outlinePresets"
      :bloom="{
        strength: config.bloom.strength,
        radius: config.bloom.radius,
        threshold: config.bloom.threshold,
        smoothWidth: config.bloom.smoothWidth,
        resolutionScale: config.bloom.resolutionScale,
      }"
      :dof="config.dof.enabled ? config.dof : undefined"
      :tilt-shift="config.tiltShift.enabled ? config.tiltShift : undefined"
      :antialias="config.antialias"
    />
  </TresCanvas>
  <slot name="hud">
    <Hud />
  </slot>
</template>
