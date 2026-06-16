import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { StatusEffectId } from '../../core/statusEffects'

export interface StatusEffectDefinition {
  statusEffectId: StatusEffectId
  label: string
  type: 'buff' | 'debuff' | 'dot' | 'cc'
  armorGate: 'physical' | 'magical' | 'none'
  /** Painful effects trigger the periodic hurt animation while active. */
  flinch: boolean
  color: string
  bgColor: string
  icon: string
}

/** Supplied by the app — fetches the status-effect definitions (e.g. from Nuxt Content). */
export type StatusEffectLoader = () => Promise<StatusEffectDefinition[]>

export const useStatusEffectStore = defineStore('statusEffects', () => {
  const effects = ref<Map<string, StatusEffectDefinition>>(new Map())

  // Computed array used by command palette and animations
  const allEffects = computed(() => [...effects.value.values()])

  /** Hydrate once from an app-provided loader. The engine never fetches content itself. */
  async function load(loader: StatusEffectLoader) {
    if (effects.value.size > 0) return
    const all = await loader()
    all.forEach(e => effects.value.set(e.statusEffectId, e))
  }

  function get(id: StatusEffectId): StatusEffectDefinition | undefined {
    return effects.value.get(id)
  }

  return { load, get, allEffects, effects }
})
