import { ref } from 'vue'
import type { Vector3 } from 'three'
import type { EventHookOn } from '@vueuse/core'
import { createSharedComposable } from '@vueuse/core'

export interface CharacterRef {
  play: (name: string, fadeTime?: number, timeScale?: number) => void
  moveTo: (point: Vector3) => void
  onArrive: EventHookOn<Vector3>
  showDamage: (value: number, type: string, critical?: boolean) => void
  meleeAttack: () => void
  lookAt: (point: Vector3) => void
}

export interface InteractableRef {
  toggle: () => void
}

export const useSceneRefs = createSharedComposable(() => {
  const characterRefs = ref<Map<string, CharacterRef>>(new Map())
  const interactableRefs = ref<Map<string, InteractableRef>>(new Map())

  function setCharacterRef(entityId: string, ref: CharacterRef | null) {
    if (ref) {
      characterRefs.value.set(entityId, ref)
    }
    else {
      characterRefs.value.delete(entityId)
    }
  }

  function setInteractableRef(entityId: string, ref: InteractableRef | null) {
    if (ref) {
      interactableRefs.value.set(entityId, ref)
    }
    else {
      interactableRefs.value.delete(entityId)
    }
  }

  function getCharacterRef(entityId: string) {
    return characterRefs.value.get(entityId) ?? null
  }

  function getInteractableRef(entityId: string) {
    return interactableRefs.value.get(entityId) ?? null
  }

  return {
    characterRefs,
    interactableRefs,
    setCharacterRef,
    setInteractableRef,
    getCharacterRef,
    getInteractableRef,
  }
})
