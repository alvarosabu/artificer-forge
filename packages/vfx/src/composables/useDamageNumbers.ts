import { ref, onScopeDispose } from 'vue'

export type DamageType = 'physical' | 'magical' | 'fire' | 'ice' | 'lightning' | 'poison' | 'healing'

export interface DamageEntry {
  id: string
  value: number
  type: DamageType
  critical: boolean
  drift: number
}

export function useDamageNumbers() {
  const numbers = ref<DamageEntry[]>([])

  function showDamage(value: number, type: DamageType, critical = false) {
    numbers.value.push({
      id:    crypto.randomUUID(),
      value: Math.abs(value),
      type,
      critical,
      drift: Math.random() < 0.5 ? -1 : 1,
    })
  }

  function removeNumber(id: string) {
    numbers.value = numbers.value.filter(n => n.id !== id)
  }

  onScopeDispose(() => {
    numbers.value = []
  })

  return { numbers, showDamage, removeNumber }
}
