export interface DamageTypeDefinition {
  damageTypeId: string
  label: string
  armorType: 'physical' | 'magical'
  color: string
  icon: string
}

export const useDamageTypeStore = defineStore('damageTypes', () => {
  const types = ref<Map<string, DamageTypeDefinition>>(new Map())

  async function load() {
    if (types.value.size > 0) return
    const all = await queryCollection('damageType').all() as unknown as DamageTypeDefinition[]
    all.forEach(t => types.value.set(t.damageTypeId, t))
  }

  function get(id: string): DamageTypeDefinition | undefined {
    return types.value.get(id)
  }

  return { load, get, types }
})
