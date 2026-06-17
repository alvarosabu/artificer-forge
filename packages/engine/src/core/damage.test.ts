import { describe, expect, it } from 'vitest'
import { computeDamage } from './damage'

describe('computeDamage', () => {
  it('depletes the matching physical armor pool before HP', () => {
    const r = computeDamage({ hp: 30, physicalArmor: 10, magicalArmor: 5 }, 4, 'physical')
    expect(r.armorAbsorbed).toBe(4)
    expect(r.hpDamage).toBe(0)
    expect(r.next.physicalArmor).toBe(6)
    expect(r.next.hp).toBe(30)
  })

  it('overflows past armor into HP', () => {
    const r = computeDamage({ hp: 30, physicalArmor: 5 }, 12, 'physical')
    expect(r.armorAbsorbed).toBe(5)
    expect(r.hpDamage).toBe(7)
    expect(r.next.physicalArmor).toBe(0)
    expect(r.next.hp).toBe(23)
  })

  it('hits the magical pool for magical damage', () => {
    const r = computeDamage({ hp: 30, physicalArmor: 10, magicalArmor: 8 }, 3, 'magical')
    expect(r.armorAbsorbed).toBe(3)
    expect(r.next.magicalArmor).toBe(5)
    expect(r.next.physicalArmor).toBeUndefined()
  })

  it('bypasses armor when armorType is undefined (true damage)', () => {
    const r = computeDamage({ hp: 30, physicalArmor: 10 }, 6)
    expect(r.armorAbsorbed).toBe(0)
    expect(r.hpDamage).toBe(6)
    expect(r.next.physicalArmor).toBeUndefined()
    expect(r.next.hp).toBe(24)
  })

  it('clamps HP at zero and treats missing fields as zero', () => {
    const r = computeDamage({ hp: 4 }, 99, 'physical')
    expect(r.next.hp).toBe(0)
    expect(r.armorAbsorbed).toBe(0)
  })
})
