import type { DropdownMenuItem } from '@nuxt/ui'
import type { EntityState } from '~/stores/game'

export interface EntityAction {
  id: string
  label: string
  icon: string
  color?: 'error' | 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'neutral'
  condition?: (entity: EntityState) => boolean
}

const interactableActions: EntityAction[] = [
  {
    id: 'examine',
    label: 'Examine',
    icon: 'i-heroicons-magnifying-glass',
  },
  {
    id: 'use',
    label: 'Open',
    icon: 'i-heroicons-lock-open',
    condition: entity => !entity.locked && !entity.opened,
  },
  {
    id: 'close',
    label: 'Close',
    icon: 'i-heroicons-lock-closed',
    condition: entity => !entity.locked && !!entity.opened,
  },
  {
    id: 'lockpick',
    label: 'Lockpick',
    icon: 'i-heroicons-key',
    condition: entity => !!entity.locked,
  },
  {
    id: 'attack',
    label: 'Attack',
    icon: 'i-heroicons-fire',
    color: 'error',
    condition: entity => !!entity.destructible,
  },
]

const characterActions: EntityAction[] = [
  {
    id: 'examine',
    label: 'Examine',
    icon: 'i-heroicons-magnifying-glass',
  },
  {
    id: 'talk',
    label: 'Talk',
    icon: 'i-heroicons-chat-bubble-left-right',
    condition: entity => !entity.hostile,
  },
  {
    id: 'attack',
    label: 'Attack',
    icon: 'i-heroicons-fire',
    color: 'error',
    condition: entity => !!entity.hostile || entity.faction !== 'player',
  },
  {
    id: 'follow',
    label: 'Follow',
    icon: 'i-heroicons-arrow-right',
    condition: entity => !entity.hostile && entity.faction === 'player',
  },
]

const itemActions: EntityAction[] = [
  {
    id: 'examine',
    label: 'Examine',
    icon: 'i-heroicons-magnifying-glass',
  },
  {
    id: 'pickup',
    label: 'Pick Up',
    icon: 'i-heroicons-hand-raised',
  },
]

const actionsByType: Record<EntityState['type'], EntityAction[]> = {
  interactable: interactableActions,
  character: characterActions,
  item: itemActions,
}

export function useEntityActions() {
  function getActionsForEntity(entity: EntityState | null): DropdownMenuItem[][] {
    if (!entity) return []

    const actions = actionsByType[entity.type] ?? []

    const items: DropdownMenuItem[] = actions
      .filter(action => !action.condition || action.condition(entity))
      .map(action => ({
        label: action.label,
        icon: action.icon,
        color: action.color,
        onSelect: () => {},
        _actionId: action.id,
      }))

    return items.length ? [items] : []
  }

  return {
    getActionsForEntity,
    actionsByType,
  }
}
