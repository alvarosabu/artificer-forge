import { describe, expect, it } from 'vitest'
import { defaultEquipmentFor, fitsRig } from '../utils/gearDefaults'

describe('defaultEquipmentFor', () => {
  it('medium-rig races start with the common starter set', () => {
    expect(defaultEquipmentFor('human')).toEqual({
      helmet: null,
      armor: 'leather-jerkin',
      cloak: null,
      trousers: 'common-pants',
      gauntlets: null,
      boots: 'leather-sandals',
    })
    expect(defaultEquipmentFor('elf')).toEqual(defaultEquipmentFor('tiefling'))
  })

  it('goblins start with the small-rig Wild Raider set', () => {
    expect(defaultEquipmentFor('goblin')).toEqual({
      helmet: null,
      armor: 'wild-raider-armor',
      cloak: null,
      trousers: 'wild-raider-pants',
      gauntlets: 'wild-raider-gauntlets',
      boots: 'wild-raider-boots',
    })
  })

  it('returns a fresh object per call — mutating one does not leak into the next', () => {
    const a = defaultEquipmentFor('human')
    a.armor = 'breastplate'
    expect(defaultEquipmentFor('human').armor).toBe('leather-jerkin')
  })
})

describe('fitsRig', () => {
  it('rig-less items are medium-fitted: fit medium races, not small ones', () => {
    expect(fitsRig({}, 'human')).toBe(true)
    expect(fitsRig({}, 'goblin')).toBe(false)
    expect(fitsRig(undefined, 'goblin')).toBe(false)
  })

  it('small-rig items fit goblins only', () => {
    expect(fitsRig({ rig: 'small' }, 'goblin')).toBe(true)
    expect(fitsRig({ rig: 'small' }, 'human')).toBe(false)
    expect(fitsRig({ rig: 'medium' }, 'elf')).toBe(true)
  })
})
