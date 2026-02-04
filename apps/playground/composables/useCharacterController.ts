import type { Group } from 'three'
import type { AnimationNameType } from './useCharacterAnimations'
import { usePointerController, type PointerControllerOptions } from './usePointerController'

export type ControllerMode = 'pointer' | 'keyboard'

export interface CharacterControllerOptions {
  /** Controller mode: 'pointer' for click-to-move, 'keyboard' for WASD (default: 'pointer') */
  mode?: ControllerMode
  speed: number
  /** Base speed the walk animation was authored for (default: 2) */
  baseAnimSpeed?: number
}

export type AnimationControls = {
  play: (name: AnimationNameType, fadeTime?: number, timeScale?: number) => void
}

/**
 * Facade for character movement controllers.
 * Delegates to specific implementations based on mode.
 */
export function useCharacterController(
  character: Ref<Group | undefined>,
  animationControls: AnimationControls,
  options: CharacterControllerOptions = { speed: 3 }
) {
  const { mode = 'pointer', ...controllerOptions } = options

  if (mode === 'keyboard') {
    // TODO: implement useKeyboardController
    console.warn('[useCharacterController] keyboard mode not yet implemented, falling back to pointer')
  }

  return usePointerController(character, animationControls, controllerOptions as PointerControllerOptions)
}
