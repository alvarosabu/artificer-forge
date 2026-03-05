import type { CommandGroup } from './useCommandPalette'
import type { StatusEffectId } from '~/stores/game'
import { STATUS_DEFINITIONS } from './useStatusEffects'

export function useStatusEffectCommands(onDone?: () => void) {
  const gameStore = useGameStore()
  const { registerGroup, unregisterGroup, pushPage, close } = useCommandPalette()

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

    const effectEntries: [StatusEffectId, typeof STATUS_DEFINITIONS[StatusEffectId]][] = mode === 'remove'
      ? (entity.statusEffects ?? []).map(e => [e.id, STATUS_DEFINITIONS[e.id]])
      : (Object.entries(STATUS_DEFINITIONS) as [StatusEffectId, typeof STATUS_DEFINITIONS[StatusEffectId]][])

    return [{
      id: `status-effect-pick-${mode}-${entityId}`,
      label: `${mode === 'add' ? 'Add' : 'Remove'} Effect`,
      items: effectEntries.map(([effectId, def]) => ({
        id: `status-effect-${mode}-${entityId}-${effectId}`,
        label: def.label,
        icon: def.icon,
        onSelect: () => {
          if (mode === 'add') {
            gameStore.addStatusEffect(entityId, effectId)
          }
          else {
            gameStore.removeStatusEffect(entityId, effectId)
          }
          close()
          onDone?.()
        },
      })),
    }]
  }

  const statusEffectGroup = computed<CommandGroup>(() => ({
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
  }))

  watch(
    () => gameStore.entities.size,
    () => {
      registerGroup(statusEffectGroup.value)
    },
    { immediate: true },
  )

  function register() {
    registerGroup(statusEffectGroup.value)
  }

  function unregister() {
    unregisterGroup('status-effects')
  }

  return { register, unregister }
}
