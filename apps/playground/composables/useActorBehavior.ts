import type { AnimationNameType } from '~/composables/useCharacterAnimations'
import { AnimationName } from '~/composables/useCharacterAnimations'
import type { EntityState } from '~/stores/game'

const validAnimNames = new Set<string>(Object.values(AnimationName))

export function useActorBehavior(
  entity: Ref<EntityState | undefined>,
  play: (name: AnimationNameType, fadeTime?: number, timeScale?: number) => void,
) {
  const idleAnim = computed(() => {
    const name = entity.value?.ai?.idleAnimation as string | undefined
    if (name && validAnimNames.has(name)) {
      return name as AnimationNameType
    }
    return AnimationName.IDLE_A
  })

  watch(idleAnim, (anim) => {
    play(anim, 0)
  }, { immediate: true })
}
