import type { CommandGroup } from './useCommandPalette'

export function useEntityCommands(onDone?: () => void) {
  const gameStore = useGameStore()
  const { registerGroup, unregisterGroup, pushPage, close } = useCommandPalette()

  const { data: templates } = useAsyncData('entity-templates', () =>
    queryCollection('entities').all(),
  )

  function buildSpawnPage(): CommandGroup[] {
    return [{
      id: 'entities-spawn-pick',
      label: 'Select Template to Spawn',
      items: (templates.value || [])
        .filter(t => t.type === 'character')
        .map(template => ({
          id: `spawn-${template.templateId}`,
          label: template.name,
          icon: 'i-heroicons-user-plus',
          onSelect: async () => {
            const offset = Math.random() * 4 - 2
            await gameStore.spawnFromTemplate(template.templateId, {
              x: offset,
              y: 0,
              z: offset,
            })
            close()
            onDone?.()
          },
        })),
    }]
  }

  function buildRemovePage(): CommandGroup[] {
    return [{
      id: 'entities-remove-pick',
      label: 'Select Entity to Remove',
      items: [...gameStore.entities.values()].map(entity => ({
        id: `remove-${entity.id}`,
        label: entity.name,
        icon: 'i-heroicons-trash',
        onSelect: () => {
          gameStore.removeEntity(entity.id)
          close()
          onDone?.()
        },
      })),
    }]
  }

  function buildSelectPage(): CommandGroup[] {
    return [{
      id: 'entities-select-pick',
      label: 'Select Character',
      items: [...gameStore.entities.values()]
        .filter(e => e.type === 'character')
        .map(entity => ({
          id: `select-${entity.id}`,
          label: `${entity.name}${gameStore.selectedEntityId === entity.id ? ' (selected)' : ''}`,
          icon: gameStore.selectedEntityId === entity.id ? 'i-heroicons-check-circle' : 'i-heroicons-cursor-arrow-rays',
          onSelect: () => {
            gameStore.selectEntity(entity.id)
            close()
            onDone?.()
          },
        })),
    }]
  }

  const entitiesGroup: CommandGroup = {
    id: 'entities',
    label: 'Entities',
    items: [
      {
        id: 'entities-spawn',
        label: 'Spawn',
        icon: 'i-heroicons-user-plus',
        onSelect: () => {
          pushPage({
            id: 'entities-spawn',
            label: 'Spawn',
            groups: buildSpawnPage(),
          })
        },
      },
      {
        id: 'entities-remove',
        label: 'Remove',
        icon: 'i-heroicons-trash',
        onSelect: () => {
          pushPage({
            id: 'entities-remove',
            label: 'Remove',
            groups: buildRemovePage(),
          })
        },
      },
      {
        id: 'entities-select',
        label: 'Select',
        icon: 'i-heroicons-cursor-arrow-rays',
        onSelect: () => {
          pushPage({
            id: 'entities-select',
            label: 'Select',
            groups: buildSelectPage(),
          })
        },
      },
    ],
  }

  function register() {
    registerGroup(entitiesGroup)
  }

  function unregister() {
    unregisterGroup('entities')
  }

  return { register, unregister }
}
