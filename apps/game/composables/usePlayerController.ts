import { LoopOnce, LoopRepeat, MathUtils, Vector3 } from 'three'
import type { AnimationAction, Camera, Object3D } from 'three'
import type { MaybeRefOrGetter, ShallowRef } from 'vue'

export type PlayerState = 'idle' | 'walk' | 'run' | 'jumpStart' | 'fall' | 'land'

export interface PlayerTuning {
  walkSpeed: number
  runSpeed: number
  /** Ground speed the walk clip was authored for. Playback scales by speed / this so the feet do not slide. */
  walkClipSpeed: number
  runClipSpeed: number
  /** How fast the facing angle catches up with the direction of travel, per second. */
  turnSpeed: number
  /** Units per second squared while the input pushes the way the character already moves. */
  acceleration: number
  /** Units per second squared while braking with no input. Lower values slide further. */
  deceleration: number
  /** Units per second squared while the input pushes straight against the motion. Sharper turns blend toward this. */
  turnAcceleration: number
  /** Fraction of the ground acceleration left for steering in the air. */
  airControl: number
  jumpVelocity: number
  gravity: number
}

// Clip speeds come from the Chamo-v4.glb foot bones: how fast the planted foot slides back
// under forward kinematics (Walking_A about 0.7, Running_A about 3.3 units per second).
export const PLAYER_TUNING: PlayerTuning = {
  walkSpeed: 1.7,
  runSpeed: 5,
  walkClipSpeed: 1.30,
  runClipSpeed: 4,
  turnSpeed: 12,
  acceleration: 20,
  deceleration: 12,
  turnAcceleration: 8,
  airControl: 0.3,
  jumpVelocity: 6,
  gravity: 20,
}

// Clip times in seconds, read from the Jump_Start and Jump_Land keyframes.
const TAKEOFF_TIME = 0.29 // the crouch ends and the feet leave the ground
const LAND_RECOVERY_TIME = 0.3 // the knees have absorbed the impact, so movement may cut in
const MIN_CLIP_TIME_SCALE = 0.25
const MAX_CLIP_TIME_SCALE = 2.5
const GROUND_Y = 0
const DEFAULT_STEP_LENGTH = 0.6

interface StateDefinition {
  clip: string
  /** Crossfade time into this state, in seconds. */
  fade: number
  once?: boolean
  /** Read every frame, so locomotion playback follows the current speed. */
  timeScale?: () => number
  enter?: (from: PlayerState) => void
  /** Returns the next state, or undefined to stay. */
  update: () => PlayerState | undefined
}

function lerpAngle(from: number, to: number, alpha: number) {
  // Wrap the difference to -PI..PI so the turn goes the short way round.
  const delta = MathUtils.euclideanModulo(to - from + Math.PI, Math.PI * 2) - Math.PI
  // Wrap the result too, so the angle does not grow without limit after many turns.
  return MathUtils.euclideanModulo(from + delta * alpha + Math.PI, Math.PI * 2) - Math.PI
}

/**
 * Moves `root` from player input, relative to the camera, and drives its clips with a state machine.
 * Idle_A is the start state and the state every one-shot clip returns to.
 */
export function usePlayerController(
  root: ShallowRef<Object3D | undefined | null>,
  actions: Record<string, AnimationAction | undefined>,
  options: {
    tuning?: MaybeRefOrGetter<PlayerTuning>
    onMove?: (position: Vector3) => void
    /** Ground distance between two onStep calls while walking or running. */
    stepLength?: MaybeRefOrGetter<number>
    /** Called every stepLength of ground travel. Footstep dust and sounds hang off this. */
    onStep?: (position: Vector3, velocity: Vector3, state: PlayerState) => void
    /** Called on touchdown with the downward speed at impact. */
    onLand?: (position: Vector3, impactSpeed: number) => void
  } = {},
) {
  const { read } = usePlayerInput()

  const state = ref<PlayerState>('idle')
  let action: AnimationAction | undefined
  let tuning = PLAYER_TUNING

  const velocity = new Vector3()
  const desired = new Vector3()
  const forward = new Vector3()
  const right = new Vector3()
  const up = new Vector3(0, 1, 0)
  let yaw = 0
  let grounded = true
  let launched = false
  let stepDistance = 0

  // Per-frame input, read by the state updates below.
  let input = read()
  let moving = false

  const finished = () => !!action && action.time >= action.getClip().duration - 1e-3
  const locomotion = (): PlayerState => (input.run ? 'run' : 'walk')
  const speed = () => Math.hypot(velocity.x, velocity.z)
  const clipTimeScale = (clipSpeed: number) =>
    MathUtils.clamp(speed() / clipSpeed, MIN_CLIP_TIME_SCALE, MAX_CLIP_TIME_SCALE)

  const states: Record<PlayerState, StateDefinition> = {
    idle: {
      clip: 'Idle_A',
      fade: 0.25,
      update: () => {
        if (input.jump) return 'jumpStart'
        if (moving) return locomotion()
      },
    },
    walk: {
      clip: 'Walking_A',
      fade: 0.2,
      timeScale: () => clipTimeScale(tuning.walkClipSpeed),
      update: () => {
        if (input.jump) return 'jumpStart'
        if (!moving) return 'idle'
        if (input.run) return 'run'
      },
    },
    run: {
      clip: 'Running_A',
      fade: 0.2,
      timeScale: () => clipTimeScale(tuning.runClipSpeed),
      update: () => {
        if (input.jump) return 'jumpStart'
        if (!moving) return 'idle'
        if (!input.run) return 'walk'
      },
    },
    jumpStart: {
      clip: 'Jump_Start',
      fade: 0.1,
      once: true,
      enter: (from) => {
        launched = false
        // A standing jump crouches first. A moving one skips the crouch so the character does not stall mid-stride.
        if (action && (from === 'walk' || from === 'run')) action.time = TAKEOFF_TIME
      },
      update: () => {
        if (!launched && action && action.time >= TAKEOFF_TIME) {
          velocity.y = tuning.jumpVelocity
          grounded = false
          launched = true
        }
        if (!launched) return
        if (grounded) return 'land'
        // The clip ends in the airborne pose that Jump_Idle starts from.
        if (finished()) return 'fall'
      },
    },
    fall: {
      clip: 'Jump_Idle',
      fade: 0.15,
      update: () => (grounded ? 'land' : undefined),
    },
    land: {
      clip: 'Jump_Land',
      fade: 0.05,
      once: true,
      update: () => {
        if (input.jump) return 'jumpStart'
        if (moving && action && action.time >= LAND_RECOVERY_TIME) return locomotion()
        if (finished()) return 'idle'
      },
    },
  }

  function enter(next: PlayerState) {
    const definition = states[next]
    const nextAction = actions[definition.clip]
    if (!nextAction) return

    const from = state.value
    nextAction.reset()
    nextAction.setLoop(definition.once ? LoopOnce : LoopRepeat, Infinity)
    // Hold the last frame so the pose does not snap to bind pose before the next state takes over.
    nextAction.clampWhenFinished = !!definition.once
    nextAction.setEffectiveTimeScale(definition.timeScale?.() ?? 1)
    nextAction.setEffectiveWeight(1)
    nextAction.fadeIn(definition.fade).play()
    if (action && action !== nextAction) action.fadeOut(definition.fade)

    action = nextAction
    state.value = next
    definition.enter?.(from)
  }

  function updateCameraBasis(camera: Camera | undefined) {
    if (camera) {
      camera.getWorldDirection(forward)
      forward.y = 0
    }
    // Looking straight down leaves no horizontal direction, so fall back to world -Z.
    if (!camera || forward.lengthSq() < 1e-6) forward.set(0, 0, -1)
    forward.normalize()
    right.crossVectors(forward, up)
  }

  const { onBeforeRender } = useLoop()

  onBeforeRender(({ delta, camera }) => {
    const object = root.value
    if (!object) return
    tuning = toValue(options.tuning) ?? PLAYER_TUNING

    // Clips exist only after the GLB loads, so the first enter waits for Idle_A.
    if (!action) {
      enter('idle')
      if (!action) return
    }

    input = read()
    const strength = Math.hypot(input.x, input.y)
    moving = strength > 0

    const next = states[state.value].update()
    if (next && next !== state.value) enter(next)

    updateCameraBasis(toValue(camera) as Camera | undefined)
    desired.set(0, 0, 0)
      .addScaledVector(right, input.x)
      .addScaledVector(forward, input.y)

    // Without input in the air, keep the momentum instead of braking.
    if (grounded || moving) {
      const targetSpeed = (input.run ? tuning.runSpeed : tuning.walkSpeed) * (moving ? 1 : 0)
      // desired already has the input strength in its length, so a half-pushed stick moves at half speed.
      desired.multiplyScalar(targetSpeed)

      let rate = tuning.deceleration
      if (moving) {
        const currentSpeed = speed()
        const desiredSpeed = Math.hypot(desired.x, desired.z)
        // 0 when the input pushes along the motion, 1 when it pushes straight back.
        const opposition = currentSpeed > 1e-3 && desiredSpeed > 1e-3
          ? (1 - (velocity.x * desired.x + velocity.z * desired.z) / (currentSpeed * desiredSpeed)) / 2
          : 0
        rate = MathUtils.lerp(tuning.acceleration, tuning.turnAcceleration, opposition)
      }
      if (!grounded) rate *= tuning.airControl

      // A constant rate instead of an exponential blend: a reversal brakes through zero at a steady pace,
      // so the character skids before it turns instead of snapping round.
      const gapX = desired.x - velocity.x
      const gapZ = desired.z - velocity.z
      const gap = Math.hypot(gapX, gapZ)
      if (gap > 1e-6) {
        const step = Math.min(gap, rate * delta) / gap
        velocity.x += gapX * step
        velocity.z += gapZ * step
      }
    }

    // Face the direction of travel, not the input, so a reversal skids facing forward and turns once it stops.
    // From rest, velocity starts along the input, so the first step still faces the input.
    if (speed() > 1e-3) {
      yaw = lerpAngle(yaw, Math.atan2(velocity.x, velocity.z), 1 - Math.exp(-tuning.turnSpeed * delta))
    }

    if (!grounded) velocity.y -= tuning.gravity * delta

    const previousX = object.position.x
    const previousY = object.position.y
    const previousZ = object.position.z
    object.position.addScaledVector(velocity, delta)

    if (!grounded && object.position.y <= GROUND_Y && velocity.y <= 0) {
      // Read before velocity.y resets, or every landing reports zero impact.
      const impactSpeed = -velocity.y
      object.position.y = GROUND_Y
      velocity.y = 0
      grounded = true
      stepDistance = 0
      options.onLand?.(object.position, impactSpeed)
    }

    // Snap tiny drift to zero so the camera target stops changing once the character stops.
    if (grounded && !moving && speed() < 1e-3) velocity.set(0, 0, 0)

    object.rotation.y = yaw

    if (grounded && (state.value === 'walk' || state.value === 'run')) {
      stepDistance += Math.hypot(object.position.x - previousX, object.position.z - previousZ)
      const stepLength = toValue(options.stepLength) ?? DEFAULT_STEP_LENGTH
      // Subtract instead of reset, so the step rhythm does not drift with the frame rate.
      if (stepDistance >= stepLength) {
        stepDistance -= stepLength
        options.onStep?.(object.position, velocity, state.value)
      }
    }

    const timeScale = states[state.value].timeScale
    if (timeScale && action) action.setEffectiveTimeScale(timeScale())

    if (
      object.position.x !== previousX
      || object.position.y !== previousY
      || object.position.z !== previousZ
    ) {
      options.onMove?.(object.position)
    }
  })

  return { state: readonly(state) }
}
