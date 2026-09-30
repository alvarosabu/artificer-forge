<script setup lang="ts">
import { useAnimations, useGLTF } from '@tresjs/cientos'
import { applyGradingToModel, stylizedOutput } from '@artificer-forge/engine/runtime'
import { useControls } from '@tresjs/leches'
import { createDustTrail } from '@artificer-forge/vfx'
import { MathUtils, Vector2, Vector3 } from 'three'
import type { Group, Mesh } from 'three'
import { PLAYER_TUNING } from '~/composables/usePlayerController'
import type { PlayerState, PlayerTuning } from '~/composables/usePlayerController'

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
  playerDeceleration,
  playerTurnAcceleration,
  playerAirControl,
  playerJumpVelocity,
  playerGravity,
} = useControls('🏃 player', {
  walkSpeed: { value: PLAYER_TUNING.walkSpeed, min: 0.1, max: 5, step: 0.05, type: 'range' },
  runSpeed: { value: PLAYER_TUNING.runSpeed, min: 0.5, max: 10, step: 0.1, type: 'range' },
  walkClipSpeed: { value: PLAYER_TUNING.walkClipSpeed, min: 0.1, max: 3, step: 0.05, type: 'range' },
  runClipSpeed: { value: PLAYER_TUNING.runClipSpeed, min: 0.5, max: 8, step: 0.05, type: 'range' },
  turnSpeed: { value: PLAYER_TUNING.turnSpeed, min: 1, max: 30, step: 0.5, type: 'range' },
  acceleration: { value: PLAYER_TUNING.acceleration, min: 1, max: 60, step: 0.5, type: 'range' },
  deceleration: { value: PLAYER_TUNING.deceleration, min: 1, max: 60, step: 0.5, type: 'range' },
  turnAcceleration: { value: PLAYER_TUNING.turnAcceleration, min: 1, max: 60, step: 0.5, type: 'range' },
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
  deceleration: playerDeceleration?.value ?? PLAYER_TUNING.deceleration,
  turnAcceleration: playerTurnAcceleration?.value ?? PLAYER_TUNING.turnAcceleration,
  airControl: playerAirControl?.value ?? PLAYER_TUNING.airControl,
  jumpVelocity: playerJumpVelocity?.value ?? PLAYER_TUNING.jumpVelocity,
  gravity: playerGravity?.value ?? PLAYER_TUNING.gravity,
}))

// Shaded by the same grading as the world, so the dust follows the day cycle and the cel ramp.
const dust = createDustTrail({
  shade: (color, normal, alpha) => stylizedOutput(color, grading, { normalNode: normal, alphaNode: alpha, hasMidTone: true, hasRim: true }),
})
// Leches watches skip the initial value, so the start opacity is applied here.
const DUST_OPACITY = 0.64
dust.setOpacity(DUST_OPACITY)

const {
  dustLifetime,
  dustSize,
  dustRise,
  dustDrag,
  dustOpacity,
  dustStepLength,
  dustWalk,
} = useControls('💨 dust', {
  lifetime: { value: dust.uniforms.lifetime.value, min: 0.2, max: 3, step: 0.05, type: 'range' },
  size: { value: 0.4, min: 0.05, max: 1.5, step: 0.01, type: 'range' },
  rise: { value: dust.uniforms.rise.value, min: 0, max: 1.5, step: 0.01, type: 'range' },
  drag: { value: dust.uniforms.drag.value, min: 0, max: 10, step: 0.1, type: 'range' },
  opacity: { value: DUST_OPACITY, min: 0, max: 1, step: 0.01, type: 'range' },
  stepLength: { value: 0.3, min: 0.1, max: 2, step: 0.05, type: 'range' },
  walk: { value: false, type: 'boolean' },
}, { uuid })

watch(dustLifetime!, (v) => { dust.uniforms.lifetime.value = v })
watch(dustRise!, (v) => { dust.uniforms.rise.value = v })
watch(dustDrag!, (v) => { dust.uniforms.drag.value = v })
watch(dustOpacity!, v => dust.setOpacity(v))

// Registered before usePlayerController, so the dust clock is current when this frame's steps emit.
const { onBeforeRender } = useLoop()
onBeforeRender(({ elapsed }) => dust.update(elapsed))
onUnmounted(() => dust.dispose())

// Scratch vectors: steps fire several times a second, so do not allocate per emit.
const back = new Vector3()
const side = new Vector3()
const spawnPoint = new Vector3()
const puffVelocity = new Vector2()
// Puff center height as a fraction of its size: the bottom sinks a little into the
// floor, so the puff sits on the ground instead of floating above it.
const SPAWN_LIFT = 0.25
// Impact speed of a standing jump with the default tuning, so that landing is a full-size burst.
const FULL_BURST_IMPACT = 6

function emitStepDust(at: Vector3, velocity: Vector3, playerState: PlayerState) {
  if (playerState === 'walk' && !dustWalk?.value) return
  const speed = Math.hypot(velocity.x, velocity.z)
  if (speed < 1e-3) return

  back.set(-velocity.x / speed, 0, -velocity.z / speed)
  side.set(-back.z, 0, back.x)
  // One random value for both offset and spread: a puff that spawns to the left also drifts left.
  const jitter = Math.random() - 0.5
  const gait = playerState === 'run' ? 1 : 0.6
  const size = (dustSize?.value ?? 0.4) * gait * (0.8 + Math.random() * 0.4)

  spawnPoint.copy(at).addScaledVector(back, 0.15).addScaledVector(side, jitter * 0.16)
  spawnPoint.y += size * SPAWN_LIFT

  // A small kick against the motion. Most of the trail must stay where it spawned,
  // or it follows the player instead of marking the path.
  const kick = speed * 0.12
  puffVelocity.set(back.x * kick + side.x * jitter * 0.3, back.z * kick + side.z * jitter * 0.3)

  dust.emit(spawnPoint, { velocity: puffVelocity, size })
}

function emitLandDust(at: Vector3, impactSpeed: number) {
  const strength = MathUtils.clamp(impactSpeed / FULL_BURST_IMPACT, 0.3, 1.5)
  const count = Math.round(5 + 5 * strength)
  const size = (dustSize?.value ?? 0.4) * (0.7 + 0.4 * strength)
  for (let i = 0; i < count; i++) {
    // Even spacing plus jitter: a perfect ring reads as a UI effect, not dust.
    const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4
    const dx = Math.cos(angle)
    const dz = Math.sin(angle)
    spawnPoint.set(at.x + dx * 0.15, at.y + size * SPAWN_LIFT, at.z + dz * 0.15)
    puffVelocity.set(dx, dz).multiplyScalar(2 * strength)
    dust.emit(spawnPoint, { velocity: puffVelocity, size })
  }
}

const root = shallowRef<Group>()

usePlayerController(root, actions, {
  tuning,
  onMove: (p) => { position.value = [p.x, p.y, p.z] },
  stepLength: () => dustStepLength?.value ?? 0.3,
  onStep: emitStepDust,
  onLand: emitLandDust,
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
  <!-- Beside the player group, not inside it: the dust is world space and must stay where it spawned. -->
  <primitive :object="dust.mesh" />
</template>
