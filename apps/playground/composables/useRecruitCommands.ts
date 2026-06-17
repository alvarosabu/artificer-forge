import type { CommandGroup } from './useCommandPalette'
import { useGameStore } from '@artificer-forge/engine/runtime'

export function useRecruitCommands() {
  const gameStore = useGameStore()
  const { registerGroup, unregisterGroup, pushPage, close } = useCommandPalette()

  function buildRecruitPage(): CommandGroup[] {
    return [{
      id: 'recruit-pick',
      label: 'Select Character to Recruit',
      items: gameStore.recruitableEntities.map(entity => ({
        id: `recruit-${entity.id}`,
        label: entity.name,
        icon: 'i-lucide-user-plus',
        onSelect: () => {
          gameStore.recruitEntity(entity.id)
          close()
        },
      })),
    }]
  }

  function buildDismissPage(): CommandGroup[] {
    return [{
      id: 'dismiss-pick',
      label: 'Select Character to Dismiss',
      items: gameStore.dismissableEntities.map(entity => ({
        id: `dismiss-${entity.id}`,
        label: entity.name,
        icon: 'i-lucide-user-minus',
        onSelect: () => {
          gameStore.dismissEntity(entity.id)
          close()
        },
      })),
    }]
  }

  const partyGroup: CommandGroup = {
    id: 'party',
    label: 'Party',
    items: [
      {
        id: 'recruit',
        label: 'Recruit',
        icon: 'i-lucide-user-plus',
        onSelect: () => {
          pushPage({
            id: 'recruit-pick',
            label: 'Recruit',
            groups: buildRecruitPage(),
          })
        },
      },
      {
        id: 'dismiss',
        label: 'Dismiss',
        icon: 'i-lucide-user-minus',
        onSelect: () => {
          pushPage({
            id: 'dismiss-pick',
            label: 'Dismiss',
            groups: buildDismissPage(),
          })
        },
      },
    ],
  }

  function register() {
    registerGroup(partyGroup)
  }

  function unregister() {
    unregisterGroup('party')
  }

  return { register, unregister }
}
