import type { CommandGroup } from './useCommandPalette'
import { type StatusEffectDefinition, useStatusEffectStore } from '@artificer-forge/engine/runtime'

export function useStatusEffectCommands(onDone?: () => void) {
  const gameStore = useGameStore()
  const { registerGroup, unregisterGroup, pushPage, close } = useCommandPalette()
  const store = useStatusEffectStore()

  function buildEntityPickerPage(mode: 'add' | 'remove'): CommandGroup[] {
    const characters = [...gameStore.entities.values()].filter(e => e.type === 'character')
    const eligible = mode === 'remove'
      ? characters.filter(e => (e.statusEffects?.length ?? 0) > 0)
      : characters

    return [{
      id: `status-effect-entities-${mode}`,
      label: `${mode === 'add' ? 'Add to' : 'Remove from'}: Select Character`,
      items: eligible.map(entity => ({
        id: `status-entity-${mode}-${entity.id}`,
        label: entity.name,
        icon: 'i-lucide-user',
        onSelect: () => {
          pushPage({
            id: `status-effect-pick-${mode}-${entity.id}`,
            label: entity.name,
            groups: buildEffectPickerPage(mode, entity.id),
          })
        },
      })),
    }]
  }

  function buildEffectPickerPage(mode: 'add' | 'remove', entityId: string): CommandGroup[] {
    const entity = gameStore.getEntity(entityId)
    if (!entity) return []

    const effectEntries: StatusEffectDefinition[] = mode === 'remove'
      ? (entity.statusEffects ?? []).reduce<StatusEffectDefinition[]>((acc, e) => {
          const def = store.get(e.id)
          if (!def) {
            console.warn(`[StatusEffectCommands] Unknown status effect id: ${e.id}`)
            return acc
          }
          return [...acc, def]
        }, [])
      : store.allEffects.filter(
          def => !entity.statusEffects?.some(e => e.id === def.statusEffectId),
        )

    return [{
      id: `status-effect-pick-${mode}-${entityId}`,
      label: `${mode === 'add' ? 'Add' : 'Remove'} Effect`,
      items: effectEntries.map(def => ({
        id: `status-effect-${mode}-${entityId}-${def.statusEffectId}`,
        label: def.label,
        icon: def.icon,
        onSelect: () => {
          if (mode === 'add') gameStore.addStatusEffect(entityId, def.statusEffectId)
          else gameStore.removeStatusEffect(entityId, def.statusEffectId)
          close()
          onDone?.()
        },
      })),
    }]
  }

  const statusEffectGroup: CommandGroup = {
    id: 'status-effects',
    label: 'Status Effects',
    items: [
      {
        id: 'status-effect-add',
        label: 'Add Status Effect',
        icon: 'i-lucide-plus-circle',
        onSelect: () => {
          pushPage({
            id: 'status-effect-add-entity',
            label: 'Add Status Effect',
            groups: buildEntityPickerPage('add'),
          })
        },
      },
      {
        id: 'status-effect-remove',
        label: 'Remove Status Effect',
        icon: 'i-lucide-minus-circle',
        onSelect: () => {
          pushPage({
            id: 'status-effect-remove-entity',
            label: 'Remove Status Effect',
            groups: buildEntityPickerPage('remove'),
          })
        },
      },
    ],
  }

  function register() {
    registerGroup(statusEffectGroup)
  }

  function unregister() {
    unregisterGroup('status-effects')
  }

  return { register, unregister }
}
