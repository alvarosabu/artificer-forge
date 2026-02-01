import type { CommandGroup } from './useCommandPalette'

export function useEntityCommands(onSelect?: () => void) {
  const gameStore = useGameStore()
  const { registerGroup, unregisterGroup } = useCommandPalette()

  // Fetch available templates
  const { data: templates } = useAsyncData('entity-templates', () =>
    queryCollection('entities').all(),
  )

  const spawnGroup = computed<CommandGroup>(() => ({
    id: 'entities-spawn',
    label: 'Entities: Spawn',
    items: (templates.value || [])
      .filter(t => t.type === 'character')
      .map(template => ({
        id: `spawn-${template.templateId}`,
        label: `Spawn ${template.name}`,
        icon: 'i-heroicons-user-plus',
        onSelect: async () => {
          const offset = Math.random() * 4 - 2
          await gameStore.spawnFromTemplate(template.templateId, {
            x: offset,
            y: 0,
            z: offset,
          })
          onSelect?.()
        },
      })),
  }))

  const removeGroup = computed<CommandGroup>(() => ({
    id: 'entities-remove',
    label: 'Entities: Remove',
    items: [...gameStore.entities.values()].map(entity => ({
      id: `remove-${entity.id}`,
      label: `Remove ${entity.name}`,
      icon: 'i-heroicons-trash',
      onSelect: () => {
        gameStore.removeEntity(entity.id)
        onSelect?.()
      },
    })),
  }))

  const selectGroup = computed<CommandGroup>(() => ({
    id: 'entities-select',
    label: 'Entities: Select',
    items: [...gameStore.entities.values()]
      .filter(e => e.type === 'character')
      .map(entity => ({
        id: `select-${entity.id}`,
        label: `Select ${entity.name}${gameStore.selectedEntityId === entity.id ? ' (selected)' : ''}`,
        icon: gameStore.selectedEntityId === entity.id ? 'i-heroicons-check-circle' : 'i-heroicons-cursor-arrow-rays',
        onSelect: () => {
          gameStore.selectEntity(entity.id)
          onSelect?.()
        },
      })),
  }))

  // Watch and re-register when data changes
  watch(
    [templates, () => gameStore.entities.size, () => gameStore.selectedEntityId],
    () => {
      if (spawnGroup.value.items.length) registerGroup(spawnGroup.value)
      if (removeGroup.value.items.length) registerGroup(removeGroup.value)
      if (selectGroup.value.items.length) registerGroup(selectGroup.value)
    },
    { immediate: true },
  )

  function register() {
    if (spawnGroup.value.items.length) registerGroup(spawnGroup.value)
    if (removeGroup.value.items.length) registerGroup(removeGroup.value)
    if (selectGroup.value.items.length) registerGroup(selectGroup.value)
  }

  function unregister() {
    unregisterGroup('entities-spawn')
    unregisterGroup('entities-remove')
    unregisterGroup('entities-select')
  }

  return {
    register,
    unregister,
  }
}
