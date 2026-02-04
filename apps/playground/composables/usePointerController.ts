import type { Group, Vector3 } from 'three'
import { createEventHook } from '@vueuse/core'
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

  const arriveHook = createEventHook<Vector3>()

  function moveTo(point: Vector3) {
    target.value = point.clone()
    animationControls.play(AnimationName.WALKING_A, 0.3, animTimeScale)
  }

  function update(delta: number) {
    if (!character.value || !target.value) return

    const direction = target.value.clone().sub(character.value.position)
    const distance = direction.length()

    if (distance < 0.1) {
      const arrivedAt = target.value.clone()
      target.value = null
      animationControls.play(AnimationName.IDLE_A)
      arriveHook.trigger(arrivedAt)
      return
    }

    // Rotate to face movement direction
    character.value.rotation.y = Math.atan2(direction.x, direction.z)

    direction.normalize()
    character.value.position.add(direction.multiplyScalar(speed * delta))
  }

  return {
    moveTo,
    update,
    isMoving,
    target,
    onArrive: arriveHook.on,
  }
}
