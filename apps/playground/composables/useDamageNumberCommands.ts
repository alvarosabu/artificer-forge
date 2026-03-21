import type { CommandGroup } from './useCommandPalette'
import type { DamageType } from './useDamageNumbers'
import type { CharacterRef } from '@artificer-forge/composables'

const DAMAGE_TYPES: DamageType[] = ['physical', 'magical', 'fire', 'ice', 'lightning', 'poison']

const TYPE_ICONS: Record<DamageType, string> = {
  physical:  'i-lucide-sword',
  magical:   'i-lucide-wand',
  fire:      'i-lucide-flame',
  ice:       'i-lucide-snowflake',
  lightning: 'i-lucide-zap',
  poison:    'i-lucide-flask-conical',
  healing:   'i-lucide-heart',
}

export function useDamageNumberCommands(
  getCharacterRef: (entityId: string) => CharacterRef | null,
) {
  const gameStore = useGameStore()
  const { registerGroup, unregisterGroup, pushPage, close } = useCommandPalette()

  function randomAmount() {
    return Math.floor(Math.random() * 80) + 5
  }

  function buildCritPickerPage(entityId: string, type: DamageType): CommandGroup[] {
    return [{
      id: `damage-crit-pick-${entityId}-${type}`,
      label: 'Normal or Critical?',
      items: [
        {
          id: `damage-normal-${entityId}-${type}`,
          label: 'Normal',
          icon: 'i-lucide-minus',
          onSelect: () => {
            getCharacterRef(entityId)?.showDamage(randomAmount(), type, false)
            close()
          },
        },
        {
          id: `damage-crit-${entityId}-${type}`,
          label: 'Critical!',
          icon: 'i-lucide-star',
          onSelect: () => {
            getCharacterRef(entityId)?.showDamage(randomAmount(), type, true)
            close()
          },
        },
      ],
    }]
  }

  function buildTypePickerPage(entityId: string, types: DamageType[]): CommandGroup[] {
    return [{
      id: `damage-type-pick-${entityId}`,
      label: 'Select Damage Type',
      items: types.map(type => ({
        id: `damage-type-${entityId}-${type}`,
        label: type.charAt(0).toUpperCase() + type.slice(1),
        icon: TYPE_ICONS[type],
        onSelect: () => {
          pushPage({
            id: `damage-crit-pick-${entityId}-${type}`,
            label: type,
            groups: buildCritPickerPage(entityId, type),
          })
        },
      })),
    }]
  }

  function buildEntityPickerPage(mode: 'damage' | 'heal'): CommandGroup[] {
    const characters = [...gameStore.entities.values()].filter(e => e.type === 'character')
    return [{
      id: `damage-entity-${mode}`,
      label: `${mode === 'damage' ? 'Deal Damage to' : 'Heal'}: Select Character`,
      items: characters.map(entity => ({
        id: `damage-entity-pick-${mode}-${entity.id}`,
        label: entity.name,
        icon: 'i-lucide-user',
        onSelect: () => {
          if (mode === 'heal') {
            pushPage({
              id: `damage-heal-crit-${entity.id}`,
              label: entity.name,
              groups: buildCritPickerPage(entity.id, 'healing'),
            })
          }
          else {
            pushPage({
              id: `damage-type-pick-${entity.id}`,
              label: entity.name,
              groups: buildTypePickerPage(entity.id, DAMAGE_TYPES),
            })
          }
        },
      })),
    }]
  }

  const damageGroup: CommandGroup = {
    id: 'damage-numbers',
    label: 'Damage Numbers',
    items: [
      {
        id: 'damage-deal',
        label: 'Deal Damage',
        icon: 'i-lucide-sword',
        onSelect: () => {
          pushPage({
            id: 'damage-deal-entity',
            label: 'Deal Damage',
            groups: buildEntityPickerPage('damage'),
          })
        },
      },
      {
        id: 'damage-heal',
        label: 'Heal',
        icon: 'i-lucide-heart',
        onSelect: () => {
          pushPage({
            id: 'damage-heal-entity',
            label: 'Heal',
            groups: buildEntityPickerPage('heal'),
          })
        },
      },
    ],
  }

  function register() {
    registerGroup(damageGroup)
  }

  function unregister() {
    unregisterGroup('damage-numbers')
  }

  return { register, unregister }
}
