import { AnimationName } from './useCharacterAnimations'

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

interface ActionHandler {
  id: string
  handler: () => void
}

const handlers = ref<ActionHandler[]>([])

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
  {
    id: 'block',
    label: 'Block',
    icon: 'i-heroicons-shield-check',
    shortcut: '2',
    category: 'common',
    cost: 'action',
  },
  {
    id: 'dodge',
    label: 'Dodge',
    icon: 'i-heroicons-arrow-trending-up',
    shortcut: '3',
    category: 'common',
    cost: 'bonusAction',
  },
  {
    id: 'ranged',
    label: 'Ranged',
    icon: 'i-heroicons-arrow-long-right',
    shortcut: '4',
    category: 'common',
    cost: 'action',
  },
  {
    id: 'magic',
    label: 'Magic',
    icon: 'i-heroicons-sparkles',
    shortcut: '5',
    category: 'common',
    cost: 'action',
  },
  {
    id: 'use-item',
    label: 'Use Item',
    icon: 'i-heroicons-hand-raised',
    shortcut: '6',
    category: 'items',
    cost: 'bonusAction',
  },
  {
    id: 'interact',
    label: 'Interact',
    icon: 'i-heroicons-cursor-arrow-ripple',
    shortcut: '7',
    category: 'common',
    cost: 'free',
  },
  {
    id: 'cheer',
    label: 'Cheer',
    icon: 'i-heroicons-face-smile',
    shortcut: '8',
    category: 'common',
    cost: 'free',
  },
]

// Maps slot IDs to animation names
export const SLOT_ANIMATION_MAP: Record<string, string> = {
  'attack-melee': AnimationName.MELEE_1H_ATTACK_CHOP,
  'block': AnimationName.MELEE_BLOCK,
  'dodge': AnimationName.DODGE_FORWARD,
  'ranged': AnimationName.RANGED_BOW_RELEASE,
  'magic': AnimationName.RANGED_MAGIC_SHOOT,
  'use-item': AnimationName.USE_ITEM,
  'interact': AnimationName.INTERACT,
  'cheer': AnimationName.CHEERING,
}

export function useActionBar() {
  const gameStore = useGameStore()

  const activeCategory = ref<'common' | 'items' | 'passives'>('common')

  const allSlots = computed<ActionSlot[]>(() => DEFAULT_SLOTS)

  const filteredSlots = computed<ActionSlot[]>(() =>
    allSlots.value.filter(s => s.category === activeCategory.value)
  )

  function setCategory(cat: 'common' | 'items' | 'passives') {
    activeCategory.value = cat
  }

  const playerEntity = computed(() => {
    if (!gameStore.party.leader) return null
    return gameStore.getEntity(gameStore.party.leader)
  })

  const playerClassId = computed(() => playerEntity.value?.class as string | undefined)

  function registerHandler(id: string, handler: () => void) {
    const existing = handlers.value.findIndex(h => h.id === id)
    if (existing > -1) {
      handlers.value[existing] = { id, handler }
    }
    else {
      handlers.value.push({ id, handler })
    }
  }

  function unregisterHandler(id: string) {
    const idx = handlers.value.findIndex(h => h.id === id)
    if (idx > -1) {
      handlers.value.splice(idx, 1)
    }
  }

  function activateSlot(index: number) {
    const slot = filteredSlots.value[index]
    if (!slot || slot.disabled) return

    const handler = handlers.value.find(h => h.id === slot.id)
    if (handler) {
      handler.handler()
    }
  }

  return {
    playerEntity,
    playerClassId,
    slots: filteredSlots,
    activeCategory,
    setCategory,
    activateSlot,
    registerHandler,
    unregisterHandler,
    SLOT_ANIMATION_MAP,
  }
}
