import type { InjectionKey, ShallowRef } from 'vue'

// Using 'any' to avoid Three.js type mismatches between packages
type Object3DLike = any

export interface OutlinePassApi {
  getGroup: (name: string) => ShallowRef<Object3DLike[]>
  addToSelection: (object: Object3DLike, group?: string) => void
  removeFromSelection: (object: Object3DLike, group?: string) => void
}

export const OutlinePassKey: InjectionKey<OutlinePassApi> = Symbol('outline-pass')

/**
 * Provider for outline selection state.
 * Used by Game.vue to share selection across components.
 */
export function useOutlinePassProvider() {
  const groups = new Map<string, ShallowRef<Object3DLike[]>>()

  function getGroup(name: string): ShallowRef<Object3DLike[]> {
    let group = groups.get(name)
    if (!group) {
      group = shallowRef<Object3DLike[]>([])
      groups.set(name, group)
    }
    return group
  }

  function addToSelection(object: Object3DLike, group: string = 'default') {
    const arr = getGroup(group)
    if (!arr.value.includes(object)) {
      arr.value = [...arr.value, object]
    }
  }

  function removeFromSelection(object: Object3DLike, group: string = 'default') {
    const arr = getGroup(group)
    const idx = arr.value.indexOf(object)
    if (idx > -1) {
      const newArr = [...arr.value]
      newArr.splice(idx, 1)
      arr.value = newArr
    }
  }

  const api: OutlinePassApi = {
    getGroup,
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
