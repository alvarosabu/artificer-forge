import type { DropdownMenuItem } from '@nuxt/ui'
import { createSharedComposable } from '@vueuse/core'
import type { EntityState, EquipmentSlotKey } from '~/stores/game'

interface MenuState {
  open: boolean
  x: number
  y: number
  itemId: string | null
}

export const useItemContextMenu = createSharedComposable(() => {
  const gameStore = useGameStore()
  const state = reactive<MenuState>({ open: false, x: 0, y: 0, itemId: null })

  const item = computed(() =>
    state.itemId ? gameStore.getEntity(state.itemId) : null,
  )

  function close() {
    state.open = false
  }

  function openAt(event: MouseEvent, itemId: string) {
    state.itemId = itemId
    state.x = event.clientX
    state.y = event.clientY
    state.open = true
  }

  function actionsFor(it: EntityState): DropdownMenuItem[][] {
    if (!it || it.type !== 'item') return []
    const ownerId = it.containerId
    const owner = ownerId ? gameStore.getEntity(ownerId) : null
    const isInCharacter = owner?.type === 'character'
    const isEquipped = !!it.slot

    const primary: DropdownMenuItem[] = []

    if (isInCharacter && owner && !isEquipped && it.subtype === 'weapon') {
      const slots = owner.equipmentSlots ?? []
      for (const slot of slots) {
        primary.push({
          label: `Equip (${slot})`,
          icon: 'i-heroicons-sparkles',
          onSelect: () => gameStore.equipItem(it.id, slot as EquipmentSlotKey),
        })
      }
    }
    if (isEquipped) {
      primary.push({
        label: 'Unequip',
        icon: 'i-heroicons-arrow-uturn-left',
        onSelect: () => gameStore.unequipItem(it.id),
      })
    }

    // Transfer to other party members
    const transferItems: DropdownMenuItem[] = gameStore.party.members
      .filter(id => id !== ownerId)
      .map((id) => {
        const target = gameStore.getEntity(id)
        return {
          label: target?.name ?? id,
          icon: 'i-heroicons-arrow-right',
          onSelect: () => gameStore.transferItem(it.id, id),
        }
      })

    const secondary: DropdownMenuItem[] = []
    if (transferItems.length) {
      secondary.push({
        label: 'Transfer to…',
        icon: 'i-heroicons-paper-airplane',
        children: transferItems,
      })
    }

    if (isInCharacter && owner && !isEquipped) {
      secondary.push({
        label: 'Drop',
        icon: 'i-heroicons-arrow-down-circle',
        onSelect: () => {
          gameStore.dropItem(it.id, owner.position)
        },
      })
    }

    return [primary, secondary].filter(g => g.length > 0)
  }

  const menuGroups = computed<DropdownMenuItem[][]>(() => {
    if (!item.value) return []
    return actionsFor(item.value)
  })

  return { state, item, menuGroups, openAt, close }
})
