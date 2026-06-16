import {
  Actor,
  CameraController,
  Character,
  CombatSystem,
  DialogCameraDirector,
  Interactable,
  SurfaceSystem,
} from '@artificer-forge/engine/runtime'

// The in-scene game components live in the engine now (not Nuxt's components/ dir),
// so register them globally to keep tag usage (<Character/>, <Actor/>, …) working
// across pages without per-file imports.
export default defineNuxtPlugin((nuxtApp) => {
  const components: Record<string, unknown> = {
    Actor,
    CameraController,
    Character,
    CombatSystem,
    DialogCameraDirector,
    Interactable,
    SurfaceSystem,
  }
  for (const [name, component] of Object.entries(components)) {
    nuxtApp.vueApp.component(name, component as Parameters<typeof nuxtApp.vueApp.component>[1])
  }
})
