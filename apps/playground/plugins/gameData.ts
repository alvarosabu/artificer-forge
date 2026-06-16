import {
  type DamageTypeDefinition,
  type StatusEffectDefinition,
  useDamageTypeStore,
  useStatusEffectStore,
} from '@artificer-forge/engine/runtime'

export default defineNuxtPlugin(async () => {
  const damageTypeStore = useDamageTypeStore()
  const statusEffectStore = useStatusEffectStore()
  await Promise.all([
    damageTypeStore.load(() => queryCollection('damageType').all() as unknown as Promise<DamageTypeDefinition[]>),
    statusEffectStore.load(() => queryCollection('statusEffect').all() as unknown as Promise<StatusEffectDefinition[]>),
  ])
})
