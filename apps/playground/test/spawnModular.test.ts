import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useGameStore } from '@artificer-forge/engine/runtime'

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
  'leather-jerkin': { templateId: 'leather-jerkin', type: 'item', subtype: 'armor', name: 'Leather Jerkin', armor: { physical: 8 } },
  'common-pants': { templateId: 'common-pants', type: 'item', subtype: 'trousers', name: 'Common Pants', armor: { physical: 1 } },
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

  it('trousers slot only accepts trousers items', async () => {
    const store = useGameStore()
    const id = await store.spawnFromTemplate('tav', { x: 0, y: 0, z: 0 })
    const jerkin = store.equippedAt(id, 'armor')!
    expect(store.isItemTypeForSlot(jerkin, 'trousers')).toBe(false)
    const pants = store.equippedAt(id, 'trousers')!
    expect(store.isItemTypeForSlot(pants, 'trousers')).toBe(true)
  })
})
