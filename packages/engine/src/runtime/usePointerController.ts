import { computed, shallowRef, type Ref } from 'vue'
import { createEventHook } from '@vueuse/core'
import type { Group, Vector3 } from 'three'
import { AnimationName, type AnimationNameType } from './useCharacterAnimations'

export interface PointerControllerOptions {
  speed: number
  /** Base speed the walk animation was authored for (default: 2) */
  baseAnimSpeed?: number
}

export function usePointerController(
  character: Ref<Group | undefined>,
  animationControls: { play: (name: AnimationNameType, fadeTime?: number, timeScale?: number) => void },
  options: PointerControllerOptions = { speed: 3 }
) {
  const { speed, baseAnimSpeed = 2 } = options
  const animTimeScale = speed / baseAnimSpeed

  const target = shallowRef<Vector3 | null>(null)
  const isMoving = computed(() => target.value !== null)

  /** How close to the target counts as arrived, in metres, measured on XZ. */
  const ARRIVE_RADIUS = 0.1

  const arriveHook = createEventHook<Vector3>()

  function moveTo(point: Vector3) {
    target.value = point.clone()
    animationControls.play(AnimationName.WALKING_A, 0.3, animTimeScale)
  }

  function update(delta: number) {
    if (!character.value || !target.value) return

    // Walking is a ground-plane problem, so both the distance and the step stay
    // on XZ. The scene owns y (terrain grounding, physics), and a target height
    // that something else keeps overwriting is a gap this loop can never close:
    // measured in 3D it would leave `distance` stuck above ARRIVE_RADIUS and the
    // character walking forever. The target keeps its y as data for markers.
    const position = character.value.position
    const dx = target.value.x - position.x
    const dz = target.value.z - position.z
    const distance = Math.hypot(dx, dz)

    if (distance < ARRIVE_RADIUS) {
      const arrivedAt = target.value.clone()
      target.value = null
      animationControls.play(AnimationName.IDLE_A)
      arriveHook.trigger(arrivedAt)
      return
    }

    // Rotate to face movement direction
    character.value.rotation.y = Math.atan2(dx, dz)

    // Clamped so a long frame lands on the target instead of stepping past it and
    // orbiting — the other way arrival never fires
    const step = Math.min(speed * delta, distance)
    position.x += (dx / distance) * step
    position.z += (dz / distance) * step
  }

  function cancelMovement() {
    target.value = null
  }

  return {
    moveTo,
    update,
    isMoving,
    target,
    onArrive: arriveHook.on,
    cancelMovement,
  }
}
