<script setup lang="ts">
import { OrbitControls } from '@tresjs/cientos'
import { useGameStore } from '../stores/game'
import type { CameraProps } from '../camera'

// Shared camera + orbit controls for every Game scene. Lives inside <Game> so the
// active PerspectiveCamera resolves via useTresContext() for any consumer (e.g.
// DialogCameraDirector). Controls auto-disable while input is blocked (dialogs, etc).
const props = withDefaults(defineProps<CameraProps>(), {
  position: () => [12.86, 12.57, 15.52],
  near: 0.1,
  far: 100,
  controls: true,
})

const gameStore = useGameStore()
</script>

<template>
  <TresPerspectiveCamera
    :position="props.position"
    :near="props.near"
    :far="props.far"
    v-bind="props.lookAt ? { lookAt: props.lookAt } : {}"
  />
  <OrbitControls
    v-if="props.controls"
    :enabled="!gameStore.inputBlocked"
    v-bind="props.target ? { target: props.target } : {}"
  />
</template>
