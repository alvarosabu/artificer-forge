import { useSceneRefs } from '@artificer-forge/composables'

interface CommandsOptions {
  entities?: boolean
  animations?: boolean
  statusEffects?: boolean
  recruit?: boolean
  actionBar?: boolean
  damageNumbers?: boolean
}

export function useCommands(options: CommandsOptions) {
  const gameStore = useGameStore()
  const { getCharacterRef } = useSceneRefs()
  const { close } = useCommandPalette()
  const { registerHandler, unregisterHandler, SLOT_ANIMATION_MAP } = useActionBar()

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

  function registerActionBar() {
    for (const [slotId, animName] of Object.entries(SLOT_ANIMATION_MAP)) {
      registerHandler(slotId, () => selectedCharacterRef.value?.play(animName))
    }
  }

  function unregisterActionBar() {
    for (const slotId of Object.keys(SLOT_ANIMATION_MAP)) {
      unregisterHandler(slotId)
    }
  }

  onMounted(() => {
    animations?.register()
    entities?.register()
    statusEffects?.register()
    recruit?.register()
    damage?.register()
    if (options.actionBar) registerActionBar()
  })

  onUnmounted(() => {
    animations?.unregister()
    entities?.unregister()
    statusEffects?.unregister()
    recruit?.unregister()
    damage?.unregister()
    if (options.actionBar) unregisterActionBar()
  })
}
