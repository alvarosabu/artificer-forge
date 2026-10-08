import { useRapier } from '@tresjs/rapier'
import type { ExposedRigidBody } from '@tresjs/rapier'
import { MathUtils, Vector3 } from 'three'
import type { ShallowRef } from 'vue'

// Gap Rapier keeps between the collider and obstacles.
const SKIN = 0.01
/**
 * How far the bottom of the collider floats above the feet. Also the highest ledge the body steps onto.
 *
 * Rapier's character controller loses its skin gap when a move pushes sideways and down into the floor
 * at the same step (dimforge/rapier#418, still there in 0.21). The collider then overlaps the floor, the
 * controller blocks the sideways move for a step, and the body sinks a little deeper each time.
 * A floating collider never touches the floor, so the controller only handles walls and ceilings,
 * and a ray holds the feet on the ground.
 */
export const RIDE_HEIGHT = 0.3
// Keeps the body glued to the floor down small drops and slopes, instead of a short fall at every edge.
const SNAP_TO_GROUND = 0.3
const MAX_SLOPE_CLIMB_ANGLE = MathUtils.degToRad(45)
const MIN_SLOPE_SLIDE_ANGLE = MathUtils.degToRad(30)
// A ground normal flatter than the climb angle has a larger up component than this.
const MIN_GROUND_NORMAL_Y = Math.cos(MAX_SLOPE_CLIMB_ANGLE)
// Mass used for the push impulse on dynamic bodies. Without it Rapier takes the kinematic body's mass,
// which nothing here tunes. The impulse scales with m·M/(m+M), so past a few times the mass of what
// it pushes, a heavier character barely pushes harder.
const CHARACTER_MASS = 5

/**
 * Moves a kinematic RigidBody whose collider floats RIDE_HEIGHT above the body origin (the feet).
 * Rapier's character controller slides the body along walls, and a ray down from the collider
 * finds the ground under the feet. Call it inside `<Physics>`.
 * Call move() from useRapier().onBeforeStep. The world steps right after, so the body is at
 * `position` by the time the frame renders.
 */
export function useCharacterBody(body: ShallowRef<ExposedRigidBody | null | undefined>) {
  const { world, rapier } = useRapier()

  const controller = world.value.createCharacterController(SKIN)
  controller.setMaxSlopeClimbAngle(MAX_SLOPE_CLIMB_ANGLE)
  controller.setMinSlopeSlideAngle(MIN_SLOPE_SLIDE_ANGLE)
  controller.setApplyImpulsesToDynamicBodies(true)
  controller.setCharacterMass(CHARACTER_MASS)

  onScopeDispose(() => world.value.removeCharacterController(controller))

  const groundRay = new rapier.value.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 })

  /** Where the body is after the coming step. */
  const position = new Vector3()
  /** What the last move() did after collisions. Shorter than the request when something blocked it. */
  const movement = new Vector3()
  let grounded = false
  let pushing = false
  let waitedOneStep = false

  /** False until the body and its collider exist and the world has stepped once with them. */
  function isReady() {
    const rigidBody = body.value?.instance
    if (!rigidBody || rigidBody.numColliders() === 0) return false
    // Scene queries only see a collider after the world steps with it. Moving before that ignores
    // the floor made in the same tick, so the body falls through it.
    if (!waitedOneStep) {
      waitedOneStep = true
      return false
    }
    return true
  }

  /** Requests a move by `delta`. Returns false while the body is not ready. */
  function move(delta: Vector3) {
    const rigidBody = body.value?.instance
    if (!waitedOneStep || !rigidBody || rigidBody.numColliders() === 0) return false
    const collider = rigidBody.collider(0)

    controller.computeColliderMovement(collider, delta)
    const computed = controller.computedMovement()
    pushing = false
    for (let i = 0; i < controller.numComputedCollisions(); i++) {
      if (controller.computedCollision(i)?.collider?.parent()?.isDynamic()) {
        pushing = true
        break
      }
    }
    const current = rigidBody.translation()
    position.set(current.x + computed.x, current.y + computed.y, current.z + computed.z)

    // The ray starts at the collider center, so it is above any ledge the feet can step onto.
    const centerHeight = collider.translation().y - current.y
    groundRay.origin.x = position.x
    groundRay.origin.y = position.y + centerHeight
    groundRay.origin.z = position.z
    // Snap down only while on the ground and not moving up, or a jump could never leave the floor.
    const snap = grounded && delta.y <= 0 ? SNAP_TO_GROUND : 0
    const hit = world.value.castRayAndGetNormal(
      groundRay,
      centerHeight + snap,
      true,
      rapier.value.QueryFilterFlags.EXCLUDE_SENSORS,
      undefined,
      undefined,
      rigidBody,
    )
    grounded = !!hit && hit.normal.y >= MIN_GROUND_NORMAL_Y
    if (hit && grounded) position.y = groundRay.origin.y - hit.timeOfImpact

    movement.set(position.x - current.x, position.y - current.y, position.z - current.z)
    rigidBody.setNextKinematicTranslation(position)
    return true
  }

  return {
    position,
    movement,
    move,
    isReady,
    isGrounded: () => grounded,
    /** True when the last move() ran into a dynamic body. The controller has pushed it by then. */
    isPushing: () => pushing,
  }
}
