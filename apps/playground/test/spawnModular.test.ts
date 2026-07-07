import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useGameStore, useModularArmor } from '@artificer-forge/engine/runtime'

const TAV_TEMPLATE = {
  templateId: 'tav',
  type: 'character' as const,
  name: 'Tav',
  race: 'human',
  sex: 'M',
  stats: { hp: 38, maxHp: 38 },
  team: 'player' as const,
  appearance: {
    body: 'HUM_M_MEDIUM_Body_A',
    head: 'HUM_M_Head_A',
    hair: 'GEN_M_Hair_Short_A',
    beard: null,
    eyebrows: 'GEN_Eyebrows_Thin_A',
    horns: null,
    skinColor: '#eecbb0',
    hairColor: '#3b2417',
  },
  equipment: { armor: 'leather-jerkin', trousers: 'common-pants', boots: 'leather-sandals' },
}

const ITEMS: Record<string, any> = {
  'leather-jerkin': {
    templateId: 'leather-jerkin',
    type: 'item',
    subtype: 'armor',
    name: 'Leather Jerkin',
    armor: { physical: 8 },
    modular: {
      slot: 'armor',
      hides: ['torso'],
      assets: { M: '/models/characters/armors/ARM_M_MEDIUM_Leather_Jerkin.glb', F: '/models/characters/armors/ARM_F_MEDIUM_Leather_Jerkin.glb' },
    },
    texture: {
      base: '/models/characters/armors/leather_jerkin_texture.png',
      tints: [{ id: 'crimson', label: 'Crimson', map: '/models/characters/armors/leather_jerkin_crimson.png' }],
    },
  },
  'common-pants': {
    templateId: 'common-pants',
    type: 'item',
    subtype: 'trousers',
    name: 'Common Pants',
    armor: { physical: 1 },
    modular: { slot: 'trousers', hides: ['hips', 'leg'], assets: { any: '/models/characters/trousers/common_pants.glb' } },
  },
  'leather-sandals': { templateId: 'leather-sandals', type: 'item', subtype: 'boots', name: 'Leather Sandals', armor: { physical: 1 } },
}

describe('spawning a modular character template', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useGameStore().configureContent({
      resolveTemplate: async (id: string) => (id === 'tav' ? TAV_TEMPLATE : ITEMS[id] ?? null),
      resolveAbility: async () => null,
      resolveDialog: async () => null,
      resolveClass: async () => null,
    } as any)
  })

  it('copies sex and appearance onto the entity', async () => {
    const store = useGameStore()
    const id = await store.spawnFromTemplate('tav', { x: 0, y: 0, z: 0 })
    const entity = store.getEntity(id)!
    expect(entity.sex).toBe('M')
    expect(entity.appearance?.body).toBe('HUM_M_MEDIUM_Body_A')
    expect(entity.appearance?.hair).toBe('GEN_M_Hair_Short_A')
    expect(entity.model).toBeUndefined()
  })

  it('equips starter gear including the trousers slot', async () => {
    const store = useGameStore()
    const id = await store.spawnFromTemplate('tav', { x: 0, y: 0, z: 0 })
    expect(store.equippedAt(id, 'armor')?.templateId).toBe('leather-jerkin')
    expect(store.equippedAt(id, 'trousers')?.templateId).toBe('common-pants')
    expect(store.equippedAt(id, 'boots')?.templateId).toBe('leather-sandals')
  })

  it('derives modular armor pieces from equipped items', async () => {
    const store = useGameStore()
    const id = await store.spawnFromTemplate('tav', { x: 0, y: 0, z: 0 })
    const pieces = useModularArmor(id)
    // Sexed jerkin resolves the M asset; unisex pants resolve `any`; sandals
    // have no modular block and render nothing.
    expect(pieces.value).toEqual([
      {
        id: 'ARM_M_MEDIUM_Leather_Jerkin',
        path: '/models/characters/armors/ARM_M_MEDIUM_Leather_Jerkin.glb',
        hides: ['torso'],
        tint: null,
      },
      {
        id: 'common_pants',
        path: '/models/characters/trousers/common_pants.glb',
        hides: ['hips', 'leg'],
        tint: null,
      },
    ])
  })

  it('resolves the appearance tint through the item texture tints', async () => {
    const store = useGameStore()
    const id = await store.spawnFromTemplate('tav', { x: 0, y: 0, z: 0 })
    store.updateEntity(id, {
      appearance: { ...store.getEntity(id)!.appearance!, equipmentTint: { armor: 'crimson' } },
    })
    const pieces = useModularArmor(id)
    expect(pieces.value[0]!.tint).toBe('/models/characters/armors/leather_jerkin_crimson.png')
  })

  it('reacts to unequipping mid-game', async () => {
    const store = useGameStore()
    const id = await store.spawnFromTemplate('tav', { x: 0, y: 0, z: 0 })
    const pieces = useModularArmor(id)
    expect(pieces.value).toHaveLength(2)
    const jerkin = store.equippedAt(id, 'armor')!
    store.moveItem(jerkin.id, { containerId: id }) // unequip → backpack
    expect(pieces.value).toHaveLength(1)
    expect(pieces.value[0]!.id).toBe('common_pants')
  })

  it('trousers slot only accepts trousers items', async () => {
    const store = useGameStore()
    const id = await store.spawnFromTemplate('tav', { x: 0, y: 0, z: 0 })
    const jerkin = store.equippedAt(id, 'armor')!
    expect(store.isItemTypeForSlot(jerkin, 'trousers')).toBe(false)
    const pants = store.equippedAt(id, 'trousers')!
    expect(store.isItemTypeForSlot(pants, 'trousers')).toBe(true)
  })
})
