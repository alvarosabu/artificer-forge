import type { StatusEffectId } from '~/shared/statusEffectIds'

export interface StatusEffectDefinition {
  statusEffectId: StatusEffectId
  label: string
  type: 'buff' | 'debuff' | 'dot' | 'cc'
  armorGate: 'physical' | 'magical' | 'none'
  color: string
  bgColor: string
  icon: string
}

export const useStatusEffectStore = defineStore('statusEffects', () => {
  const effects = ref<Map<string, StatusEffectDefinition>>(new Map())

  // Computed array used by command palette and animations
  const allEffects = computed(() => [...effects.value.values()])

  async function load() {
    if (effects.value.size > 0) return
    const all = await queryCollection('statusEffect').all() as unknown as StatusEffectDefinition[]
    all.forEach(e => effects.value.set(e.statusEffectId, e))
  }

  function get(id: StatusEffectId): StatusEffectDefinition | undefined {
    return effects.value.get(id)
  }

  return { load, get, allEffects }
})
