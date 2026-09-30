<script setup lang="ts">
import { useAnimations, useGLTF } from '@tresjs/cientos'
import { applyGradingToModel } from '@artificer-forge/engine/runtime'
import { useControls } from '@tresjs/leches'
import type { Group, Mesh } from 'three'
import { PLAYER_TUNING } from '~/composables/usePlayerController'
import type { PlayerTuning } from '~/composables/usePlayerController'

const position = defineModel<[number, number, number]>('position', { default: () => [0, 0, 0] })

const uuid = inject<string>('uuid')
const grading = useGrading()

const { state } = useGLTF('/models/chamo/Chamo-v4.glb', { draco: true })

const scene = computed(() => state.value?.scene)
const animations = computed(() => state.value?.animations ?? [])

const { actions } = useAnimations(animations, scene)

const {
  playerWalkSpeed,
  playerRunSpeed,
  playerWalkClipSpeed,
  playerRunClipSpeed,
  playerTurnSpeed,
  playerAcceleration,
  playerAirControl,
  playerJumpVelocity,
  playerGravity,
} = useControls('🏃 player', {
  walkSpeed: { value: PLAYER_TUNING.walkSpeed, min: 0.1, max: 5, step: 0.05, type: 'range' },
  runSpeed: { value: PLAYER_TUNING.runSpeed, min: 0.5, max: 10, step: 0.1, type: 'range' },
  walkClipSpeed: { value: PLAYER_TUNING.walkClipSpeed, min: 0.1, max: 3, step: 0.05, type: 'range' },
  runClipSpeed: { value: PLAYER_TUNING.runClipSpeed, min: 0.5, max: 8, step: 0.05, type: 'range' },
  turnSpeed: { value: PLAYER_TUNING.turnSpeed, min: 1, max: 30, step: 0.5, type: 'range' },
  acceleration: { value: PLAYER_TUNING.acceleration, min: 1, max: 30, step: 0.5, type: 'range' },
  airControl: { value: PLAYER_TUNING.airControl, min: 0, max: 1, step: 0.05, type: 'range' },
  jumpVelocity: { value: PLAYER_TUNING.jumpVelocity, min: 1, max: 15, step: 0.1, type: 'range' },
  gravity: { value: PLAYER_TUNING.gravity, min: 1, max: 60, step: 0.5, type: 'range' },
}, { uuid })

const tuning = computed<PlayerTuning>(() => ({
  walkSpeed: playerWalkSpeed?.value ?? PLAYER_TUNING.walkSpeed,
  runSpeed: playerRunSpeed?.value ?? PLAYER_TUNING.runSpeed,
  walkClipSpeed: playerWalkClipSpeed?.value ?? PLAYER_TUNING.walkClipSpeed,
  runClipSpeed: playerRunClipSpeed?.value ?? PLAYER_TUNING.runClipSpeed,
  turnSpeed: playerTurnSpeed?.value ?? PLAYER_TUNING.turnSpeed,
  acceleration: playerAcceleration?.value ?? PLAYER_TUNING.acceleration,
  airControl: playerAirControl?.value ?? PLAYER_TUNING.airControl,
  jumpVelocity: playerJumpVelocity?.value ?? PLAYER_TUNING.jumpVelocity,
  gravity: playerGravity?.value ?? PLAYER_TUNING.gravity,
}))

const root = shallowRef<Group>()

usePlayerController(root, actions, {
  tuning,
  onMove: (p) => { position.value = [p.x, p.y, p.z] },
})

watch(scene, (model) => {
  if (!model) return
  model.traverse((child) => {
    if ((child as Mesh).isMesh) child.castShadow = true
  })
  applyGradingToModel(model, grading)
}, { immediate: true })
</script>

<template>
  <TresGroup ref="root">
    <primitive
      v-if="scene"
      :object="scene"
    />
  </TresGroup>
</template>
