import { createSharedComposable, createEventHook } from '@vueuse/core'

export interface ActionSlot {
  id: string
  label: string
  icon: string
  shortcut?: string
  color?: 'error' | 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'neutral'
  disabled?: boolean
  // New
  category: 'common' | 'items' | 'passives'
  cost?: 'action' | 'bonusAction' | 'free'
  quantity?: number
  active?: boolean
}

const DEFAULT_SLOTS: ActionSlot[] = [
  {
    id: 'attack-melee',
    label: 'Attack',
    icon: 'i-heroicons-bolt',
    shortcut: '1',
    color: 'error',
    category: 'common',
    cost: 'action',
  },
]

export const useActionBar = createSharedComposable(() => {
  const gameStore = useGameStore()

  const activeCategory = ref<'common' | 'items' | 'passives'>('common')
  const slotActivated = createEventHook<ActionSlot>()

  const filteredSlots = computed<ActionSlot[]>(() =>
    DEFAULT_SLOTS.filter(s => s.category === activeCategory.value)
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

  defineShortcuts({
    '1': () => activateSlot(0),
    '2': () => activateSlot(1),
    '3': () => activateSlot(2),
    '4': () => activateSlot(3),
    '5': () => activateSlot(4),
    '6': () => activateSlot(5),
    '7': () => activateSlot(6),
    '8': () => activateSlot(7),
    '9': () => activateSlot(8),
    '0': () => activateSlot(9),
  })

  return {
    playerEntity,
    playerClassId,
    slots: filteredSlots,
    activeCategory,
    setCategory,
    activateSlot,
    onSlotActivated: slotActivated.on,
  }
})
