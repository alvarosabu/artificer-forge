import type { InjectionKey, ShallowRef } from 'vue'

// Using 'any' to avoid Three.js type mismatches between packages
type Object3DLike = any

export interface OutlinePassApi {
  selectedObjects: ShallowRef<Object3DLike[]>
  addToSelection: (object: Object3DLike) => void
  removeFromSelection: (object: Object3DLike) => void
}

export const OutlinePassKey: InjectionKey<OutlinePassApi> = Symbol('outline-pass')

/**
 * Provider for outline selection state.
 * Used by Game.vue to share selection across components.
 */
export function useOutlinePassProvider() {
  const selectedObjects = shallowRef<Object3DLike[]>([])

  watch(selectedObjects, (newSelectedObjects) => {
    console.log('selectedObjects', newSelectedObjects)
  })

  function addToSelection(object: Object3DLike) {
    if (!selectedObjects.value.includes(object)) {
      selectedObjects.value = [...selectedObjects.value, object]
    }
  }

  function removeFromSelection(object: Object3DLike) {
    const idx = selectedObjects.value.indexOf(object)
    if (idx > -1) {
      const newArr = [...selectedObjects.value]
      newArr.splice(idx, 1)
      selectedObjects.value = newArr
    }
  }

  const api: OutlinePassApi = {
    selectedObjects,
    addToSelection,
    removeFromSelection,
  }

  provide(OutlinePassKey, api)

  return api
}

/**
 * Consumer hook for components to add/remove objects from outline selection.
 */
export function useOutlinePass() {
  const api = inject(OutlinePassKey)
  if (!api) {
    throw new Error('useOutlinePass must be used within a Game component')
  }
  return api
}
