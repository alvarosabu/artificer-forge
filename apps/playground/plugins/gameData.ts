export default defineNuxtPlugin(async () => {
  const damageTypeStore = useDamageTypeStore()
  const statusEffectStore = useStatusEffectStore()
  await Promise.all([
    damageTypeStore.load(),
    statusEffectStore.load(),
  ])
})
