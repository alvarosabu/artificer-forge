<script setup lang="ts">
// Engine composition root — sits above the /core, /runtime and /ui layers.
// Owns the canvas + renderer + camera + in-scene systems (runtime) and mounts
// the HUD overlay (ui). Renderer and post-processing are engine policy; render
// config (bloom, outline presets) comes from useGameConfig().
import { NoToneMapping } from 'three'
import { EffectComposer, useDofFocusProvider, useOutlinePassProvider } from '@artificer-forge/post-processing'
import { CameraController, CombatSystem, SurfaceSystem, createWebGPURenderer, useContextMenuProvider, useGameConfig } from '@artificer-forge/engine/runtime'
import type { CameraProps } from '@artificer-forge/engine/runtime'
import { Hud } from '@artificer-forge/engine/ui'

// Per-scene camera override forwarded to the default CameraController; omit to
// inherit the default. Ignored when the #camera slot is overridden.
defineProps<{ camera?: CameraProps }>()

const config = useGameConfig()

// Set up the context-menu provider here so both the canvas (pointer-missed) and
// the HUD (which injects it) share one instance.
const { close } = useContextMenuProvider()
useOutlinePassProvider()
// The party leader claims the DOF focus from Character.vue; the pass reads it here.
useDofFocusProvider()

function handlePointerMissed() {
  close()
}

</script>

<template>
  <!-- dpr is a [min, max] clamp on the system value, not a fixed ratio. Uncapped, a
       Retina display renders 4x the pixels, and every post-processing pass pays that
       multiplier again. 1.5 is where this art style stops showing the difference:
       flat colour fields and cutout foliage have no fine detail to lose. -->
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
    <!-- Gameplay systems — override to compose your own set (engine + custom),
         or pass an empty #systems slot for non-gameplay scenes (menus, char select).
         Keyed off slot PRESENCE, not slot output: <slot> falls back whenever the
         provided slot renders nothing, so an empty #systems would otherwise get
         the defaults anyway — and CombatSystem's flat ground-click plane would
         quietly outrank a scene's own terrain. -->
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
      :antialias="config.antialias"
    />
  </TresCanvas>
  <slot name="hud">
    <Hud />
  </slot>
</template>
