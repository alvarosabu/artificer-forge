import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface DamageTypeDefinition {
  damageTypeId: string
  label: string
  armorType: 'physical' | 'magical'
  color: string
  icon: string
}

/** Supplied by the app — fetches the damage-type definitions (e.g. from Nuxt Content). */
export type DamageTypeLoader = () => Promise<DamageTypeDefinition[]>

export const useDamageTypeStore = defineStore('damageTypes', () => {
  const types = ref<Map<string, DamageTypeDefinition>>(new Map())

  /** Hydrate once from an app-provided loader. The engine never fetches content itself. */
  async function load(loader: DamageTypeLoader) {
    if (types.value.size > 0) return
    const all = await loader()
    all.forEach(t => types.value.set(t.damageTypeId, t))
  }

  function get(id: string): DamageTypeDefinition | undefined {
    return types.value.get(id)
  }

  return { load, get, types }
})
