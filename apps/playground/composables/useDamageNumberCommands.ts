import type { CommandGroup } from './useCommandPalette'
import type { DamageType } from '@artificer-forge/vfx'
import type { CharacterRef } from '@artificer-forge/composables'

export function useDamageNumberCommands(
  getCharacterRef: (entityId: string) => CharacterRef | null,
) {
  const gameStore = useGameStore()
  const damageTypeStore = useDamageTypeStore()
  const { registerGroup, unregisterGroup, pushPage, close } = useCommandPalette()

  function randomAmount() {
    return Math.floor(Math.random() * 10) + 3
  }

  function applyAndShow(entityId: string, damageTypeId: string, critical: boolean) {
    const amount = randomAmount()
    gameStore.applyDamage(entityId, amount, damageTypeId)
    getCharacterRef(entityId)?.showDamage(amount, damageTypeId as DamageType, critical)
    close()
  }

  function buildCritPickerPage(entityId: string, damageTypeId: string, label: string): CommandGroup[] {
    return [{
      id: `damage-crit-pick-${entityId}-${damageTypeId}`,
      label: 'Normal or Critical?',
      items: [
        {
          id: `damage-normal-${entityId}-${damageTypeId}`,
          label: 'Normal',
          icon: 'i-lucide-minus',
          onSelect: () => {
            if (damageTypeId === 'healing') {
              const amount = randomAmount()
              const entity = gameStore.getEntity(entityId)
              if (entity) gameStore.updateEntity(entityId, { hp: Math.min(entity.maxHp ?? amount, (entity.hp ?? 0) + amount) })
              getCharacterRef(entityId)?.showDamage(amount, 'healing', false)
              close()
              return
            }
            applyAndShow(entityId, damageTypeId, false)
          },
        },
        {
          id: `damage-crit-${entityId}-${damageTypeId}`,
          label: 'Critical!',
          icon: 'i-lucide-star',
          onSelect: () => {
            if (damageTypeId === 'healing') {
              const amount = randomAmount()
              const entity = gameStore.getEntity(entityId)
              if (entity) gameStore.updateEntity(entityId, { hp: Math.min(entity.maxHp ?? amount, (entity.hp ?? 0) + amount) })
              getCharacterRef(entityId)?.showDamage(amount, 'healing', true)
              close()
              return
            }
            applyAndShow(entityId, damageTypeId, true)
          },
        },
      ],
    }]
  }

  function buildTypePickerPage(entityId: string): CommandGroup[] {
    const types = [...damageTypeStore.types.values()]
    return [{
      id: `damage-type-pick-${entityId}`,
      label: 'Select Damage Type',
      items: types.map(type => ({
        id: `damage-type-${entityId}-${type.damageTypeId}`,
        label: `${type.label} (vs ${type.armorType})`,
        icon: type.icon,
        onSelect: () => {
          pushPage({
            id: `damage-crit-pick-${entityId}-${type.damageTypeId}`,
            label: type.label,
            groups: buildCritPickerPage(entityId, type.damageTypeId, type.label),
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
              groups: buildCritPickerPage(entity.id, 'healing', 'Healing'),
            })
          }
          else {
            pushPage({
              id: `damage-type-pick-${entity.id}`,
              label: entity.name,
              groups: buildTypePickerPage(entity.id),
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
