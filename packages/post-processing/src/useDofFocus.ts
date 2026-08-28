import { provide, inject, shallowRef, type InjectionKey, type ShallowRef } from 'vue'

// Using 'any' to avoid Three.js type mismatches between packages
type Object3DLike = any

export interface DofFocusApi {
  /** null = the pass falls back to its fixed focusDistance. */
  target: ShallowRef<Object3DLike | null>
  setFocusTarget: (object: Object3DLike | null) => void
  /** Clears the target only if it is still `object`, so a stale unmount cannot drop a newer target. */
  clearFocusTarget: (object: Object3DLike) => void
}

export const DofFocusKey: InjectionKey<DofFocusApi> = Symbol('dof-focus')

export function useDofFocusProvider() {
  const target = shallowRef<Object3DLike | null>(null)

  function setFocusTarget(object: Object3DLike | null) {
    target.value = object
  }

  function clearFocusTarget(object: Object3DLike) {
    if (target.value === object) target.value = null
  }

  const api: DofFocusApi = { target, setFocusTarget, clearFocusTarget }
  provide(DofFocusKey, api)
  return api
}

/** null when no provider exists, so scenes without post-processing still work. */
export function useDofFocus(): DofFocusApi | null {
  return inject(DofFocusKey, null)
}
