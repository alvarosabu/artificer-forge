import { provide, inject, shallowRef, type InjectionKey, type ShallowRef } from 'vue'
import type { DirectionalLight, PointLight } from 'three'

/** The only light types GodraysNode raymarches (it samples the light's shadow map). */
export type GodraysLight = DirectionalLight | PointLight

export interface GodraysLightApi {
  /** null = no godrays pass is built, even when the config enables it. */
  light: ShallowRef<GodraysLight | null>
  setGodraysLight: (light: GodraysLight | null) => void
  /** Clears the light only if it is still `light`, so a stale unmount cannot drop a newer light. */
  clearGodraysLight: (light: GodraysLight) => void
}

export const GodraysLightKey: InjectionKey<GodraysLightApi> = Symbol('godrays-light')

export function useGodraysLightProvider() {
  const light = shallowRef<GodraysLight | null>(null)

  function setGodraysLight(next: GodraysLight | null) {
    light.value = next
  }

  function clearGodraysLight(previous: GodraysLight) {
    if (light.value === previous) light.value = null
  }

  const api: GodraysLightApi = { light, setGodraysLight, clearGodraysLight }
  provide(GodraysLightKey, api)
  return api
}

/** null when no provider exists, so scenes without post-processing still work. */
export function useGodraysLight(): GodraysLightApi | null {
  return inject(GodraysLightKey, null)
}
