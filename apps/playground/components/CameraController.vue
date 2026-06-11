<script setup lang="ts">
// Shared camera + orbit controls for every Game scene. Lives inside <Game> so the
// active PerspectiveCamera resolves via useTresContext() for any consumer (e.g.
// DialogCameraDirector). Controls auto-disable while input is blocked (dialogs, etc).
interface Props {
  position?: [number, number, number]
  lookAt?: [number, number, number]
  target?: [number, number, number]
  near?: number
  far?: number
  controls?: boolean
}

const props = withDefaults(defineProps<Props>(), {
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
