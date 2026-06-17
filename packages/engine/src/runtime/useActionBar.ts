import { computed, readonly, ref, watch } from 'vue'
import { createEventHook, createSharedComposable } from '@vueuse/core'
import { useGameStore } from './stores/game'

export interface ActionSlot {
  id: string
  label: string
  icon: string
  shortcut?: string
  color?: 'error' | 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'neutral'
  disabled?: boolean
  category: 'common' | 'items' | 'passives'
  cost?: 'action' | 'bonusAction' | 'free'
  quantity?: number
  active?: boolean
  abilityId?: string
}

const ABILITY_COLORS: Record<string, ActionSlot['color']> = {
  slashing: 'error',
  bludgeoning: 'error',
  piercing: 'warning',
  force: 'info',
  fire: 'error',
  ice: 'info',
  lightning: 'warning',
}

export type WeaponSlot = 'mainHand' | 'offHand' | 'none'

export const useActionBar = createSharedComposable(() => {
  const gameStore = useGameStore()

  const activeCategory = ref<'common' | 'items' | 'passives'>('common')
  const slotActivated = createEventHook<ActionSlot>()
  const activeWeaponSlot = ref<WeaponSlot>('mainHand')

  const abilitySlots = ref<ActionSlot[]>([])

  watch(
    () => gameStore.party.leader,
    async (leaderId) => {
      if (!leaderId) {
        abilitySlots.value = []
        return
      }
      const entity = gameStore.getEntity(leaderId)
      const abilityIds = entity?.abilities ?? []

      if (abilityIds.length === 0) {
        abilitySlots.value = []
        return
      }

      const slots: ActionSlot[] = []
      for (let i = 0; i < abilityIds.length; i++) {
        const template = await gameStore.resolveAbility(abilityIds[i])
        if (!template) continue

        slots.push({
          id: `ability-${template.abilityId}`,
          label: template.name,
          icon: template.icon ?? 'i-heroicons-bolt',
          shortcut: String(i + 1),
          color: ABILITY_COLORS[template.damage?.type ?? ''] ?? 'primary',
          category: 'common',
          cost: template.cost,
          abilityId: template.abilityId,
        })
      }
      abilitySlots.value = slots
    },
    { immediate: true },
  )

  const filteredSlots = computed<ActionSlot[]>(() =>
    abilitySlots.value.filter(s => s.category === activeCategory.value),
  )

  function setCategory(cat: 'common' | 'items' | 'passives') {
    activeCategory.value = cat
  }

  const playerEntity = computed(() => {
    if (!gameStore.party.leader) return null
    return gameStore.getEntity(gameStore.party.leader)
  })

  const playerClassId = computed(() => playerEntity.value?.class as string | undefined)

  function activateSlot(index: number) {
    const slot = filteredSlots.value[index]
    if (!slot || slot.disabled) return
    slotActivated.trigger(slot)
  }

  function setActiveWeaponSlot(slot: WeaponSlot) {
    activeWeaponSlot.value = slot
  }

  function toggleWeaponSlot() {
    activeWeaponSlot.value = activeWeaponSlot.value === 'mainHand' ? 'offHand' : 'mainHand'
  }

  return {
    playerEntity,
    playerClassId,
    slots: filteredSlots,
    activeCategory,
    setCategory,
    activateSlot,
    onSlotActivated: slotActivated.on,
    activeWeaponSlot: readonly(activeWeaponSlot),
    setActiveWeaponSlot,
    toggleWeaponSlot,
  }
})
