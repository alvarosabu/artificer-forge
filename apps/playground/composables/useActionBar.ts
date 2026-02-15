import { AnimationName } from './useCharacterAnimations'

export interface ActionSlot {
  id: string
  label: string
  icon: string
  shortcut?: string
  color?: 'error' | 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'neutral'
  disabled?: boolean
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
  },
  {
    id: 'block',
    label: 'Block',
    icon: 'i-heroicons-shield-check',
    shortcut: '2',
  },
  {
    id: 'dodge',
    label: 'Dodge',
    icon: 'i-heroicons-arrow-trending-up',
    shortcut: '3',
  },
  {
    id: 'ranged',
    label: 'Ranged',
    icon: 'i-heroicons-arrow-long-right',
    shortcut: '4',
  },
  {
    id: 'magic',
    label: 'Magic',
    icon: 'i-heroicons-sparkles',
    shortcut: '5',
  },
  {
    id: 'use-item',
    label: 'Use Item',
    icon: 'i-heroicons-hand-raised',
    shortcut: '6',
  },
  {
    id: 'interact',
    label: 'Interact',
    icon: 'i-heroicons-cursor-arrow-ripple',
    shortcut: '7',
  },
  {
    id: 'cheer',
    label: 'Cheer',
    icon: 'i-heroicons-face-smile',
    shortcut: '8',
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

  const playerEntity = computed(() => {
    if (!gameStore.party.leader) return null
    return gameStore.getEntity(gameStore.party.leader)
  })

  const slots = computed<ActionSlot[]>(() => DEFAULT_SLOTS)

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
    const slot = slots.value[index]
    if (!slot || slot.disabled) return

    const handler = handlers.value.find(h => h.id === slot.id)
    if (handler) {
      handler.handler()
    }
  }

  return {
    playerEntity,
    slots,
    activateSlot,
    registerHandler,
    unregisterHandler,
    SLOT_ANIMATION_MAP,
  }
}
