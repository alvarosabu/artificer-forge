import {
  type DamageTypeDefinition,
  type EntityTemplate,
  type SceneDef,
  type StatusEffectDefinition,
  useDamageTypeStore,
  useGameStore,
  useStatusEffectStore,
} from '@artificer-forge/engine/runtime'

export default defineNuxtPlugin(async () => {
  const gameStore = useGameStore()
  const damageTypeStore = useDamageTypeStore()
  const statusEffectStore = useStatusEffectStore()

  // Inject Nuxt Content as the engine's content source (the engine fetches nothing itself).
  gameStore.configureContent({
    resolveTemplate: templateId =>
      queryCollection('entities').where('templateId', '=', templateId).first() as unknown as Promise<EntityTemplate | null>,
    resolveScene: sceneId =>
      queryCollection('scenes').where('sceneId', '=', sceneId).first() as unknown as Promise<SceneDef | null>,
    resolveAbility: abilityId =>
      queryCollection('abilities').where('abilityId', '=', abilityId).first(),
    resolveDialog: dialogId =>
      queryCollection('dialogs').where('dialogId', '=', dialogId).first(),
  })

  await Promise.all([
    damageTypeStore.load(() => queryCollection('damageType').all() as unknown as Promise<DamageTypeDefinition[]>),
    statusEffectStore.load(() => queryCollection('statusEffect').all() as unknown as Promise<StatusEffectDefinition[]>),
  ])
})
