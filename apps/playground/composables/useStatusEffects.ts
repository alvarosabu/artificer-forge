import type { StatusEffectId } from '~/shared/statusEffectIds'
import type { StatusEffectDefinition } from '~/stores/statusEffects'

export type StatusEffectType = 'debuff' | 'dot' | 'cc' | 'buff'

export interface StatusDefinition {
  label: string
  type: StatusEffectType
  icon: string
  color: string
  bgColor: string
}

export const STATUS_DEFINITIONS: Record<StatusEffectId, StatusDefinition> = {
  poisoned: {
    label: 'Poisoned',
    type: 'debuff',
    icon: 'i-lucide-skull',
    color: 'text-green-400',
    bgColor: 'bg-green-900',
  },
  stunned: {
    label: 'Stunned',
    type: 'cc',
    icon: 'i-lucide-star',
    color: 'text-yellow-300',
    bgColor: 'bg-yellow-800',
  },
  burning: {
    label: 'Burning',
    type: 'dot',
    icon: 'i-lucide-flame',
    color: 'text-orange-400',
    bgColor: 'bg-orange-900',
  },
  blessed: {
    label: 'Blessed',
    type: 'buff',
    icon: 'i-lucide-sparkles',
    color: 'text-amber-300',
    bgColor: 'bg-amber-800',
  },
  hasted: {
    label: 'Hasted',
    type: 'buff',
    icon: 'i-lucide-zap',
    color: 'text-blue-400',
    bgColor: 'bg-blue-900',
  },
  wet: {
    label: 'Wet',
    type: 'debuff',
    icon: 'i-lucide-droplets',
    color: 'text-sky-300',
    bgColor: 'bg-sky-900',
  },
  slowed: {
    label: 'Slowed',
    type: 'debuff',
    icon: 'i-lucide-snail',
    color: 'text-amber-400',
    bgColor: 'bg-amber-900',
  },
  frozen: {
    label: 'Frozen',
    type: 'cc',
    icon: 'i-lucide-snowflake',
    color: 'text-cyan-300',
    bgColor: 'bg-cyan-900',
  },
  encumbered: {
    label: 'Encumbered',
    type: 'debuff',
    icon: 'i-lucide-weight',
    color: 'text-stone-300',
    bgColor: 'bg-stone-800',
  },
}
export function useStatusEffects() {
  const store = useStatusEffectStore()
  return {
    getDefinition: (id: StatusEffectId) => store.get(id),
  }
}
