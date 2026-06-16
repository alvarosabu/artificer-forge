import type { ComputedRef } from 'vue'
import { AnimationName, type AnimationNameType } from '@artificer-forge/engine/runtime'
export function useStatusEffectAnimations(
  entityId: ComputedRef<string>,
  play: (name: AnimationNameType, fadeTime?: number) => void,
) {
  const gameStore = useGameStore()
  const store = useStatusEffectStore()

  let flinchTimer: ReturnType<typeof setInterval> | null = null
  let flinchReturnTimer: ReturnType<typeof setTimeout> | null = null

  function startFlinchLoop() {
    flinchTimer = setInterval(() => {
      play(AnimationName.HIT_A, 0.2)
      flinchReturnTimer = setTimeout(() => {
        play(AnimationName.SKELETONS_IDLE, 0.3)
      }, 800)
    }, 3000)
  }

  function stopFlinchLoop() {
    if (flinchTimer) { clearInterval(flinchTimer); flinchTimer = null }
    if (flinchReturnTimer) { clearTimeout(flinchReturnTimer); flinchReturnTimer = null }
  }

  watch(
    () => gameStore.getEntity(entityId.value),
    (entity) => {
      if (!entity || (entity.hp != null && entity.hp <= 0)) {
        stopFlinchLoop()
        return
      }
      const hasFlinchEffect = entity.statusEffects?.some((se) => {
        // store.get() is not tracked as a reactive dependency here.
        // This is intentional: the watch fires on entity changes (addStatusEffect → updateEntity),
        // which covers all cases. Definitions are loaded once at startup and never mutated.
        return store.get(se.id)?.flinch ?? false
      }) ?? false
      if (hasFlinchEffect) startFlinchLoop()
      else stopFlinchLoop()
    },
    { deep: true },
  )

  onScopeDispose(stopFlinchLoop)
}
