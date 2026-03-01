import type { StatusEffectId } from '~/stores/game'

export interface StatusDefinition {
  label: string
  icon: string
  color: string
  bgColor: string
}

export const STATUS_DEFINITIONS: Record<StatusEffectId, StatusDefinition> = {
  poisoned: {
    label: 'Poisoned',
    icon: 'i-lucide-skull',
    color: 'text-green-400',
    bgColor: 'bg-green-900',
  },
  stunned: {
    label: 'Stunned',
    icon: 'i-lucide-star',
    color: 'text-yellow-300',
    bgColor: 'bg-yellow-800',
  },
  burning: {
    label: 'Burning',
    icon: 'i-lucide-flame',
    color: 'text-orange-400',
    bgColor: 'bg-orange-900',
  },
  blessed: {
    label: 'Blessed',
    icon: 'i-lucide-sparkles',
    color: 'text-amber-300',
    bgColor: 'bg-amber-800',
  },
  hasted: {
    label: 'Hasted',
    icon: 'i-lucide-zap',
    color: 'text-blue-400',
    bgColor: 'bg-blue-900',
  },
}

export function useStatusEffects() {
  return { STATUS_DEFINITIONS }
}
