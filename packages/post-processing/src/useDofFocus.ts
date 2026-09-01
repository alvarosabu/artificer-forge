import { provide, inject, shallowRef, type InjectionKey, type ShallowRef } from 'vue'
import type { Object3D } from 'three'

export interface DofFocusApi {
  /** null = the pass falls back to its fixed focusDistance. */
  target: ShallowRef<Object3D | null>
  setFocusTarget: (object: Object3D | null) => void
  /** Clears the target only if it is still `object`, so a stale unmount cannot drop a newer target. */
  clearFocusTarget: (object: Object3D) => void
}

export const DofFocusKey: InjectionKey<DofFocusApi> = Symbol('dof-focus')

export function useDofFocusProvider() {
  const target = shallowRef<Object3D | null>(null)

  function setFocusTarget(object: Object3D | null) {
    target.value = object
  }

  function clearFocusTarget(object: Object3D) {
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
