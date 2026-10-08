import { LoopOnce, LoopRepeat, MathUtils, Vector3 } from 'three'
import type { AnimationAction, Camera, Object3D } from 'three'
import type { MaybeRefOrGetter, ShallowRef } from 'vue'
import { useRapier } from '@tresjs/rapier'
import type { ExposedRigidBody } from '@tresjs/rapier'

export type PlayerState = 'spawn' | 'idle' | 'walk' | 'run' | 'jumpStart' | 'fall' | 'land'

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
  /** Peak of a full jump, in units. The take-off speed is derived from it and gravity. */
  jumpHeight: number
  /** Units per second squared on the way up. */
  gravity: number
  /** Gravity scale on the way down. Falling faster than rising is most of what makes a jump feel snappy. */
  fallMultiplier: number
  /** Gravity scale for the rest of the rise once the button is released, so a tap is a short hop. */
  lowJumpMultiplier: number
  /** Seconds after walking off an edge in which a jump still takes off. */
  coyoteTime: number
  /** Seconds a press is kept before landing, so a slightly early press still jumps. */
  jumpBuffer: number
}

export const PLAYER_TUNING: PlayerTuning = {
  walkSpeed: 3.5,
  runSpeed: 5,
  walkClipSpeed: 2.35,
  runClipSpeed: 4,
  turnSpeed: 12,
  acceleration: 46,
  deceleration: 12,
  turnAcceleration: 8,
  airControl: 0.3,
  jumpHeight: 0.9,
  gravity: 20,
  fallMultiplier: 1.8,
  lowJumpMultiplier: 4,
  coyoteTime: 0.12,
  jumpBuffer: 0.15,
}

const TAKEOFF_TIME = 0.29 // the crouch ends and the feet leave the ground
const LAND_RECOVERY_TIME = 0.3 // the knees have absorbed the impact, so movement may cut in
const MIN_CLIP_TIME_SCALE = 0.25
const MAX_CLIP_TIME_SCALE = 2.5
const DEFAULT_STEP_LENGTH = 0.6
const TERMINAL_FALL_SPEED = 40

interface StateDefinition {
  clip: string
  /** Crossfade time into this state, in seconds. */
  fade: number
  once?: boolean
  locksInput?: boolean
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
 * Moves `body` from player input, relative to the camera, and drives the clips with a state machine.
 * `root` sits inside the body and only turns to face the direction of travel.
 * Spawn_Ground plays once on mount, then Idle_A takes over. Idle_A is the state every one-shot clip returns to.
 * Call it inside `<Physics>`.
 */
export function usePlayerController(
  root: ShallowRef<Object3D | undefined | null>,
  body: ShallowRef<ExposedRigidBody | undefined | null>,
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
  const characterBody = useCharacterBody(body)

  const state = ref<PlayerState>('idle')
  let action: AnimationAction | undefined
  let tuning = PLAYER_TUNING

  const velocity = new Vector3()
  const desired = new Vector3()
  const translation = new Vector3()
  const forward = new Vector3()
  const right = new Vector3()
  const up = new Vector3(0, 1, 0)
  let yaw = 0
  let grounded = true
  let launched = false
  let stepDistance = 0
  // Seconds left in which a jump may still take off (coyote) or a press still counts (buffer).
  let coyote = 0
  let buffer = 0
  // Only a release after take-off cuts the jump. A standing jump crouches for TAKEOFF_TIME, longer
  // than a tap, so a release before take-off would turn every tapped standing jump into the lowest hop.
  let cutArmed = false
  let jumpCut = false

  // Per-frame input, read by the state updates below.
  let input = read()
  let moving = false

  const finished = () => !!action && action.time >= action.getClip().duration - 1e-3
  const locomotion = (): PlayerState => (input.run ? 'run' : 'walk')
  const wantsJump = () => buffer > 0
  const speed = () => Math.hypot(velocity.x, velocity.z)
  const clipTimeScale = (clipSpeed: number) =>
    MathUtils.clamp(speed() / clipSpeed, MIN_CLIP_TIME_SCALE, MAX_CLIP_TIME_SCALE)

  const states: Record<PlayerState, StateDefinition> = {
    spawn: {
      clip: 'Spawn_Ground',
      // Nothing plays before it, so a fade would blend from the bind pose.
      fade: 0,
      once: true,
      locksInput: true,
      update: () => (finished() ? 'idle' : undefined),
    },
    idle: {
      clip: 'Idle_A',
      fade: 0.25,
      update: () => {
        if (!grounded) return 'fall'
        if (wantsJump()) return 'jumpStart'
        if (moving) return locomotion()
      },
    },
    walk: {
      clip: 'Walking_A',
      fade: 0.2,
      timeScale: () => clipTimeScale(tuning.walkClipSpeed),
      update: () => {
        if (!grounded) return 'fall'
        if (wantsJump()) return 'jumpStart'
        if (!moving) return 'idle'
        if (input.run) return 'run'
      },
    },
    run: {
      clip: 'Running_A',
      fade: 0.2,
      timeScale: () => clipTimeScale(tuning.runClipSpeed),
      update: () => {
        if (!grounded) return 'fall'
        if (wantsJump()) return 'jumpStart'
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
        // Spent here, or the press would jump again on landing.
        buffer = 0
        // A standing jump crouches first. A moving one skips the crouch so the character does not stall mid-stride,
        // and a coyote jump skips it because the feet are already off the ground.
        if (action && (from === 'walk' || from === 'run' || from === 'fall')) action.time = TAKEOFF_TIME
      },
      update: () => {
        if (!launched && action && action.time >= TAKEOFF_TIME) {
          // The speed at which gravity stops the rise exactly jumpHeight up.
          velocity.y = Math.sqrt(2 * tuning.gravity * tuning.jumpHeight)
          grounded = false
          launched = true
          // Spent, or a coyote jump could fire again in the air.
          coyote = 0
          cutArmed = input.jumpHeld
          jumpCut = false
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
      update: () => {
        if (wantsJump() && coyote > 0) return 'jumpStart'
        if (grounded) return 'land'
      },
    },
    land: {
      clip: 'Jump_Land',
      fade: 0.05,
      once: true,
      update: () => {
        if (wantsJump()) return 'jumpStart'
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

  const { camera } = useTresContext()
  const { onBeforeStep } = useRapier()

  // Runs once per physics step, not per frame. The body can only move once per step,
  // so a second move before the step would replace the first one instead of adding to it.
  onBeforeStep((delta) => {
    const object = root.value
    // Checked before anything integrates, or gravity builds up speed while the body is not there yet.
    if (!object || !characterBody.isReady()) return
    tuning = toValue(options.tuning) ?? PLAYER_TUNING

    // Clips exist only after the GLB loads, so the first enter waits for them.
    if (!action) {
      enter('spawn')
      if (!action) enter('idle')
      if (!action) return
    }

    input = read()
    if (states[state.value].locksInput) {
      input.x = 0
      input.y = 0
      input.jump = false
      input.jumpHeld = false
    }
    const strength = Math.hypot(input.x, input.y)
    moving = strength > 0

    // grounded is still from the last step, so the window opens on the step the feet leave the floor.
    coyote = grounded ? tuning.coyoteTime : Math.max(coyote - delta, 0)
    buffer = input.jump ? tuning.jumpBuffer : Math.max(buffer - delta, 0)
    if (cutArmed && !input.jumpHeld) {
      jumpCut = true
      cutArmed = false
    }

    const next = states[state.value].update()
    if (next && next !== state.value) enter(next)

    updateCameraBasis(camera.activeCamera.value as Camera | undefined)
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

    // Gravity also pulls while grounded, so a walk off an edge starts falling on the same step.
    let gravity = tuning.gravity
    if (velocity.y <= 0) gravity *= tuning.fallMultiplier
    else if (jumpCut) gravity *= tuning.lowJumpMultiplier
    velocity.y = Math.max(velocity.y - gravity * delta, -TERMINAL_FALL_SPEED)

    translation.copy(velocity).multiplyScalar(delta)
    if (!characterBody.move(translation)) return
    const { movement, position } = characterBody
    const touchingGround = characterBody.isGrounded()

    if (!grounded && touchingGround && velocity.y <= 0) {
      // Read before velocity.y resets, or every landing reports zero impact.
      const impactSpeed = -velocity.y
      velocity.y = 0
      grounded = true
      stepDistance = 0
      options.onLand?.(position, impactSpeed)
    }
    else if (grounded && touchingGround) {
      // The floor stopped the pull, so do not let the downward speed build up.
      velocity.y = 0
    }
    else if (grounded && !touchingGround) {
      grounded = false
    }
    // A wall cancels the blocked part of the move. Without this, the speed keeps building
    // against the wall and the player shoots off sideways once past it.
    // Not against a dynamic body: the push impulse comes from the blocked part of the move, so
    // cancelling it drops the next request to a few millimetres and the push to almost nothing.
    if (delta > 0) {
      if (!characterBody.isPushing()) {
        velocity.x = movement.x / delta
        velocity.z = movement.z / delta
      }
      // Same for a ceiling, or the jump sticks to it until gravity uses up the take-off speed.
      if (velocity.y > 0) velocity.y = Math.min(velocity.y, movement.y / delta)
    }

    // Snap tiny drift to zero so the camera target stops changing once the character stops.
    if (grounded && !moving && speed() < 1e-3) velocity.set(0, 0, 0)

    object.rotation.y = yaw

    if (grounded && (state.value === 'walk' || state.value === 'run')) {
      stepDistance += Math.hypot(movement.x, movement.z)
      const stepLength = toValue(options.stepLength) ?? DEFAULT_STEP_LENGTH
      // Subtract instead of reset, so the step rhythm does not drift with the frame rate.
      if (stepDistance >= stepLength) {
        stepDistance -= stepLength
        options.onStep?.(position, velocity, state.value)
      }
    }

    const timeScale = states[state.value].timeScale
    if (timeScale && action) action.setEffectiveTimeScale(timeScale())

    // Below 1 mm per step counts as no move, so the camera target stays still at the end of a stop.
    if (movement.lengthSq() > 1e-6) options.onMove?.(position)
  })

  return { state: readonly(state) }
}
