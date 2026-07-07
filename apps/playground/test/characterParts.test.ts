import { describe, expect, it } from 'vitest'
import { forRaceSex, HEADS, HORNS } from '../utils/characterParts'

describe('forRaceSex', () => {
  it('tieflings share the elf heads', () => {
    const elf = forRaceSex(HEADS, 'elf', 'M').map(p => p.id)
    const tif = forRaceSex(HEADS, 'tiefling', 'M').map(p => p.id)
    expect(tif).toEqual(elf)
    expect(tif).toContain('ELF_M_Head_A')
  })

  it('humans do not get elf/tiefling heads', () => {
    const ids = forRaceSex(HEADS, 'human', 'F').map(p => p.id)
    expect(ids).toEqual(['HUM_F_Head_A'])
  })

  it('horns are tiefling-only and unisex', () => {
    expect(forRaceSex(HORNS, 'tiefling', 'M')).toHaveLength(4)
    expect(forRaceSex(HORNS, 'tiefling', 'F')).toHaveLength(4)
    expect(forRaceSex(HORNS, 'human', 'M')).toHaveLength(0)
    expect(forRaceSex(HORNS, 'elf', 'F')).toHaveLength(0)
  })

  it('race-agnostic parts pass through for every race', () => {
    const generic = [{ id: 'GEN_Hair_X', label: 'X', path: '/x.glb' }]
    expect(forRaceSex(generic, 'tiefling', 'M')).toHaveLength(1)
    expect(forRaceSex(generic, 'human', 'F')).toHaveLength(1)
  })
})
