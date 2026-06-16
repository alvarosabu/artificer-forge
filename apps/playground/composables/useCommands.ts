import { useSceneRefs } from '@artificer-forge/engine/runtime'

interface CommandsOptions {
  entities?: boolean
  animations?: boolean
  statusEffects?: boolean
  recruit?: boolean
  damageNumbers?: boolean
}

export function useCommands(options: CommandsOptions) {
  const gameStore = useGameStore()
  const { getCharacterRef } = useSceneRefs()
  const { close } = useCommandPalette()

  const selectedCharacterRef = computed(() =>
    gameStore.selectedEntityId ? getCharacterRef(gameStore.selectedEntityId) : null,
  )

  const animations = options.animations
    ? useAnimationCommands(selectedCharacterRef, close)
    : null
  const entities = options.entities ? useEntityCommands() : null
  const statusEffects = options.statusEffects ? useStatusEffectCommands() : null
  const recruit = options.recruit ? useRecruitCommands() : null
  const damage = options.damageNumbers ? useDamageNumberCommands(getCharacterRef) : null

  onMounted(() => {
    animations?.register()
    entities?.register()
    statusEffects?.register()
    recruit?.register()
    damage?.register()
  })

  onUnmounted(() => {
    animations?.unregister()
    entities?.unregister()
    statusEffects?.unregister()
    recruit?.unregister()
    damage?.unregister()
  })
}
