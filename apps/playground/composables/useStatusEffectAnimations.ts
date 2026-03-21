import type { ComputedRef } from 'vue'
import { AnimationName, type AnimationNameType } from '@artificer-forge/composables'
import { STATUS_DEFINITIONS } from '~/composables/useStatusEffects'

export function useStatusEffectAnimations(
  entityId: ComputedRef<string>,
  play: (name: AnimationNameType, fadeTime?: number) => void,
) {
  const gameStore = useGameStore()

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
    () => gameStore.getEntity(entityId.value)?.statusEffects,
    (effects) => {
      const hasFlinchEffect = effects?.some(se => {
        const def = STATUS_DEFINITIONS[se.id]
        return def?.type === 'debuff' || def?.type === 'dot'
      }) ?? false
      if (hasFlinchEffect) startFlinchLoop()
      else stopFlinchLoop()
    },
    { deep: true },
  )

  onScopeDispose(stopFlinchLoop)
}
