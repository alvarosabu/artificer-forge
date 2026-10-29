<script setup lang="ts">
import { useAnimations, useGLTF } from '@tresjs/cientos'
import { applyGradingToModel, sampleHeight, stylizedOutput } from '@artificer-forge/engine/runtime'
import type { HeightField } from '@artificer-forge/engine/runtime'
import { useControls } from '@tresjs/leches'
import { CapsuleCollider, RigidBody } from '@tresjs/rapier'
import type { ExposedRigidBody } from '@tresjs/rapier'
import { createDustTrail } from '@artificer-forge/vfx'
import { useDofFocus } from '@artificer-forge/post-processing'
import { MathUtils, Vector2, Vector3 } from 'three'
import { positionWorld } from 'three/tsl'
import type { Group, Mesh } from 'three'
import { RIDE_HEIGHT } from '~/composables/useCharacterBody'
import type { ColliderSurface } from '~/composables/useStaticColliders'
import { isSwimming, PLAYER_TUNING } from '~/composables/usePlayerController'
import type { PlayerState, PlayerTuning } from '~/composables/usePlayerController'

const props = withDefaults(defineProps<{
  /** Read once on mount, where the body is created. */
  spawn?: [number, number, number]
  /** Ground for the grading's contact occlusion. Without it the ground is y = 0. */
  heightField?: HeightField | null
  /** The grass coverage at a point, or 0 where there is no grass. */
  grassAt?: (x: number, z: number) => number
  /** The surface tag of a collider handle, or null for untagged ground. */
  surfaceAt?: (collider: number | null) => ColliderSurface | null
  /** Height of the water surface at a point, or null where there is no water. Defaults to the Ocean at y = 0. */
  waterAt?: (x: number, z: number) => number | null
}>(), {
  spawn: () => [0, 0, 0],
  heightField: null,
  grassAt: () => 0,
  waterAt: () => null,
  surfaceAt: () => null,
})

const position = defineModel<[number, number, number]>('position', { default: () => [0, 0, 0] })
// the camera follows this, and it only changes once the player moves
position.value = [...props.spawn]

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
  playerJumpHeight,
  playerGravity,
  playerFallMultiplier,
  playerLowJumpMultiplier,
  playerCoyoteTime,
  playerJumpBuffer,
  playerSwimSpeed,
  playerFastSwimSpeed,
  playerSwimDepth,
  playerPlungeSlide,
  playerFloatFrequency,
  playerFloatDamping,
  playerPlungeKeep,
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
  jumpHeight: { value: PLAYER_TUNING.jumpHeight, min: 0.1, max: 4, step: 0.05, type: 'range' },
  gravity: { value: PLAYER_TUNING.gravity, min: 1, max: 60, step: 0.5, type: 'range' },
  fallMultiplier: { value: PLAYER_TUNING.fallMultiplier, min: 1, max: 4, step: 0.05, type: 'range' },
  lowJumpMultiplier: { value: PLAYER_TUNING.lowJumpMultiplier, min: 1, max: 8, step: 0.1, type: 'range' },
  coyoteTime: { value: PLAYER_TUNING.coyoteTime, min: 0, max: 0.4, step: 0.01, type: 'range' },
  jumpBuffer: { value: PLAYER_TUNING.jumpBuffer, min: 0, max: 0.4, step: 0.01, type: 'range' },
  swimSpeed: { value: PLAYER_TUNING.swimSpeed, min: 0.1, max: 6, step: 0.05, type: 'range' },
  fastSwimSpeed: { value: PLAYER_TUNING.fastSwimSpeed, min: 0.1, max: 8, step: 0.05, type: 'range' },
  swimDepth: { value: PLAYER_TUNING.swimDepth, min: 0.2, max: 2.5, step: 0.05, type: 'range' },
  plungeSlide: { value: PLAYER_TUNING.plungeSlide, min: 0, max: 1, step: 0.05, type: 'range' },
  floatFrequency: { value: PLAYER_TUNING.floatFrequency, min: 0.2, max: 3, step: 0.05, type: 'range' },
  floatDamping: { value: PLAYER_TUNING.floatDamping, min: 0.05, max: 1.5, step: 0.01, type: 'range' },
  plungeKeep: { value: PLAYER_TUNING.plungeKeep, min: 0, max: 1, step: 0.05, type: 'range' },
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
  jumpHeight: playerJumpHeight?.value ?? PLAYER_TUNING.jumpHeight,
  gravity: playerGravity?.value ?? PLAYER_TUNING.gravity,
  fallMultiplier: playerFallMultiplier?.value ?? PLAYER_TUNING.fallMultiplier,
  lowJumpMultiplier: playerLowJumpMultiplier?.value ?? PLAYER_TUNING.lowJumpMultiplier,
  coyoteTime: playerCoyoteTime?.value ?? PLAYER_TUNING.coyoteTime,
  jumpBuffer: playerJumpBuffer?.value ?? PLAYER_TUNING.jumpBuffer,
  swimSpeed: playerSwimSpeed?.value ?? PLAYER_TUNING.swimSpeed,
  fastSwimSpeed: playerFastSwimSpeed?.value ?? PLAYER_TUNING.fastSwimSpeed,
  swimDepth: playerSwimDepth?.value ?? PLAYER_TUNING.swimDepth,
  plungeSlide: playerPlungeSlide?.value ?? PLAYER_TUNING.plungeSlide,
  floatFrequency: playerFloatFrequency?.value ?? PLAYER_TUNING.floatFrequency,
  floatDamping: playerFloatDamping?.value ?? PLAYER_TUNING.floatDamping,
  plungeKeep: playerPlungeKeep?.value ?? PLAYER_TUNING.plungeKeep,
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

const { onBeforeRender } = useLoop()
onBeforeRender(({ elapsed }) => dust.update(elapsed))
onUnmounted(() => dust.dispose())

const back = new Vector3()
const side = new Vector3()
const spawnPoint = new Vector3()
const puffVelocity = new Vector2()
const surfacePoint = new Vector3()

const SPAWN_LIFT = 0.25
const FULL_BURST_IMPACT = 6

const audio = useAudio()
audio.load('stepSand', 'stepGrass', 'stepWater', 'stepWood', 'land', 'splash', 'swim')
const IMPACT_SPEEDS = { quiet: 3, loud: 12 }

/** The point on the water surface above `at`, or null when `at` is not under water. */
function waterAbove(at: Vector3) {
  const level = props.waterAt(at.x, at.z)
  if (level === null || at.y >= level) return null
  return surfacePoint.set(at.x, level, at.z)
}

function emitStepDust(at: Vector3, velocity: Vector3, playerState: PlayerState) {
  if (waterAbove(at)) return

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

function emitStep(at: Vector3, velocity: Vector3, playerState: PlayerState) {
  const surface = waterAbove(at)
  if (surface) splash.stroke(surface, velocity)
  else emitStepDust(at, velocity, playerState)
}

function emitLandDust(at: Vector3, impactSpeed: number) {
  if (waterAbove(at)) return
  audio.play('land', { volume: impactLevel({ impactSpeed, ...IMPACT_SPEEDS }) })
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

// Sized to Chamo-v4.glb: about 2.3 units tall with the hair, the body about 0.7 wide.
// The head and arms stick out past the radius on purpose, so the player can brush past walls.
const CAPSULE_RADIUS = 0.4
const CAPSULE_HEIGHT = 2.2

// The capsule floats RIDE_HEIGHT above the feet and reaches up to CAPSULE_HEIGHT.
// Rapier's capsule takes the half height of the straight part, without the round caps.
const capsuleHalfHeight = Math.max(0, (CAPSULE_HEIGHT - RIDE_HEIGHT) / 2 - CAPSULE_RADIUS)
const capsuleArgs: [number, number] = [capsuleHalfHeight, CAPSULE_RADIUS]
const capsuleOffset: [number, number, number] = [0, RIDE_HEIGHT + capsuleHalfHeight + CAPSULE_RADIUS, 0]

const root = shallowRef<Group>()
const body = shallowRef<ExposedRigidBody>()

const splash = useSplash()

const controller = usePlayerController(root, body, actions, {
  tuning,
  onMove: (p) => { position.value = [p.x, p.y, p.z] },
  stepLength: () => dustStepLength?.value ?? 0.3,
  onStep: emitStep,
  onLand: emitLandDust,
  waterAt: props.waterAt,
  onSplash: (surface, impactSpeed, motion) => {
    splash.burst(surface, motion.length())
    audio.play('splash', { volume: impactLevel({ impactSpeed, ...IMPACT_SPEEDS }) })
  },
})

// One bob every 2π / 2.4 ≈ 2.6 seconds.
const BOB_SPEED = 2.4
const BOB_HEIGHT = 0.06
const SWAY = 0.05
let floatWeight = 0
let treadCycle = 0
const treadPoint = new Vector3()

watch(root, (group) => {
  // Yaw outermost, so the sway tilts around the character's own axes.
  if (group) group.rotation.order = 'YXZ'
}, { immediate: true })

const dofFocus = useDofFocus()
watch(root, (group, previous) => {
  if (previous) dofFocus?.clearFocusTarget(previous)
  if (group) dofFocus?.setFocusTarget(group)
}, { immediate: true })

onUnmounted(() => {
  if (root.value) dofFocus?.clearFocusTarget(root.value)
})

const feet = new Vector3()

/** The step sound for the ground under the feet: water over the feet wins, then a tagged collider, then grass, then the sand everywhere else. */
function stepSound(): SoundName {
  feet.fromArray(position.value)
  if (waterAbove(feet)) return 'stepWater'
  if (props.surfaceAt(controller.groundCollider()) === 'wood') return 'stepWood'
  return props.grassAt(feet.x, feet.z) > 0.5 ? 'stepGrass' : 'stepSand'
}

const contacts = useClipContacts(actions, controller.state, (state) => {
  audio.play(isSwimming(state) ? 'swim' : stepSound())
})

onBeforeRender(({ elapsed, delta }) => {
  contacts.update(elapsed)

  const group = root.value
  if (!group) return
  const swimming = isSwimming(controller.state.value)
  floatWeight += ((swimming ? 1 : 0) - floatWeight) * (1 - Math.exp(-4 * delta))
  const phase = elapsed * BOB_SPEED
  group.position.y = Math.sin(phase) * BOB_HEIGHT * floatWeight
  group.rotation.x = Math.sin(phase * 0.5 + 1.3) * SWAY * floatWeight
  group.rotation.z = Math.sin(phase * 0.7) * SWAY * floatWeight

  // Runs on land too, so the first frame in the water does not see an old count and fire a ring on top of the splash.
  const cycle = Math.floor((phase - 1.5 * Math.PI) / (2 * Math.PI))
  if (swimming && cycle !== treadCycle) {
    const surface = waterAbove(treadPoint.fromArray(position.value))
    if (surface) splash.tread(surface)
  }
  treadCycle = cycle

  const stroking = controller.state.value === 'stroke' || controller.state.value === 'fastStroke'
  const wakeSurface = stroking ? waterAbove(treadPoint.fromArray(position.value)) : null
  if (wakeSurface) splash.swim(wakeSurface, group.rotation.y)
  else splash.endSwim()
})

watch(scene, (model) => {
  if (!model) return
  model.traverse((child) => {
    if ((child as Mesh).isMesh) child.castShadow = true
  })
  const groundHeight = props.heightField ? sampleHeight(props.heightField, positionWorld.xz) : undefined
  applyGradingToModel(model, grading, { groundHeight })
}, { immediate: true })
</script>

<template>
  <!-- The body owns the position and stays upright. root inside it only turns to face the travel direction. -->
  <RigidBody
    ref="body"
    type="kinematic"
    :position="props.spawn"
    :collider="false"
  >
    <CapsuleCollider
      :args="capsuleArgs"
      :position="capsuleOffset"
    />
    <TresGroup ref="root">
      <primitive
        v-if="scene"
        :object="scene"
      />
    </TresGroup>
  </RigidBody>
  <primitive :object="dust.mesh" />
  <primitive :object="splash.object" />
</template>
