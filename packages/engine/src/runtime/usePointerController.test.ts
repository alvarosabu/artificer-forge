import { Group, Vector3 } from 'three'
import { shallowRef } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { usePointerController } from './usePointerController'

// usePointerController only needs AnimationName from useCharacterAnimations, which
// drags in cientos (and its unresolvable directory import) at module load
vi.mock('@tresjs/cientos', () => ({ useAnimations: () => ({}), useGLTF: () => ({}) }))

function setup(speed = 3) {
  const character = shallowRef<Group | undefined>(new Group())
  const played: string[] = []
  const controller = usePointerController(character, {
    play: (name: string) => { played.push(name) },
  } as never, { speed })
  return { character, played, controller }
}

// 60 fps steps, capped so a runaway walk fails instead of hanging
function run(update: (d: number) => void, frames: number, onFrame?: () => void) {
  for (let i = 0; i < frames; i++) {
    update(1 / 60)
    onFrame?.()
  }
}

describe('usePointerController', () => {
  it('arrives at a target on flat ground', () => {
    const { controller } = setup()
    controller.moveTo(new Vector3(5, 0, 0))
    run(controller.update, 200)
    expect(controller.isMoving.value).toBe(false)
  })

  // The scene owns y: a grounding pass rewrites it every frame from the terrain
  // under the character. A 3D arrival test never closes that gap, so the walk
  // never ends.
  it('arrives when a grounding pass keeps overwriting y', () => {
    const { character, controller } = setup()
    const groundHeight = (x: number) => x * 0.5 // a constant slope

    controller.moveTo(new Vector3(5, 0, 0))
    run(controller.update, 400, () => {
      character.value!.position.y = groundHeight(character.value!.position.x)
    })

    expect(controller.isMoving.value).toBe(false)
    // stops inside the arrival radius, not at the exact metre
    expect(Math.abs(character.value!.position.x - 5)).toBeLessThan(0.1)
  })

  it('ignores the target height when measuring distance', () => {
    const { character, controller } = setup()
    // clicked point carries the terrain height; the character stands at y = 0
    controller.moveTo(new Vector3(0, 8, 3))
    run(controller.update, 400)

    expect(controller.isMoving.value).toBe(false)
    expect(character.value!.position.y).toBe(0) // the controller never drives y
  })
})
