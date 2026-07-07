import { describe, expect, it } from 'vitest'
import { forRaceSex, parsePart, type PartEntry } from '../utils/partManifest'
import { PART_OVERRIDES } from '../utils/partOverrides'

describe('parsePart', () => {
  it('derives slot path, sex and race from the stem', () => {
    expect(parsePart('HUM_M_Head_A', 'heads')).toEqual({
      id: 'HUM_M_Head_A',
      label: 'Human Male A',
      path: '/models/characters/heads/HUM_M_Head_A.glb',
      sex: 'M',
      race: ['human'],
    })
  })

  it('does not read MEDIUM as male — sex is the second token only', () => {
    const body = parsePart('HUM_F_MEDIUM_Body_A', 'bodies')!
    expect(body.sex).toBe('F')
    const beard = parsePart('GEN_Beard_Medium_A', 'beards')!
    expect(beard.sex).toBeUndefined()
  })

  it('trailing variant letters survive in labels (Short_F is not a sex)', () => {
    const hair = parsePart('GEN_M_Hair_Short_F', 'hair')!
    expect(hair.sex).toBe('M')
    expect(hair.label).toBe('Short F')
  })

  it('GEN parts are race-agnostic, TIF parts are tiefling-only', () => {
    expect(parsePart('GEN_M_Hair_Short_A', 'hair')!.race).toBeUndefined()
    expect(parsePart('TIF_Horns_A', 'horns')!.race).toEqual(['tiefling'])
  })

  it('rejects stems outside the naming convention', () => {
    expect(parsePart('leather_sandals', 'hair')).toBeNull()
    expect(parsePart('rig_medium', 'bodies')).toBeNull()
  })

  it('applies overrides over parsed fields', () => {
    const head = parsePart('ELF_M_Head_A', 'heads', PART_OVERRIDES)!
    expect(head.race).toEqual(['elf', 'tiefling'])
  })
})

describe('forRaceSex', () => {
  const heads = ['HUM_M_Head_A', 'HUM_F_Head_A', 'ELF_M_Head_A', 'ELF_F_Head_A']
    .map(s => parsePart(s, 'heads', PART_OVERRIDES)!)

  it('tieflings share the elf heads', () => {
    const elf = forRaceSex(heads, 'elf', 'M').map(p => p.id)
    const tif = forRaceSex(heads, 'tiefling', 'M').map(p => p.id)
    expect(tif).toEqual(elf)
    expect(tif).toContain('ELF_M_Head_A')
  })

  it('humans do not get elf/tiefling heads', () => {
    const ids = forRaceSex(heads, 'human', 'F').map(p => p.id)
    expect(ids).toEqual(['HUM_F_Head_A'])
  })

  it('horns are tiefling-only and unisex', () => {
    const horns = ['TIF_Horns_A', 'TIF_Horns_B', 'TIF_Horns_C', 'TIF_Horns_D']
      .map(s => parsePart(s, 'horns')!)
    expect(forRaceSex(horns, 'tiefling', 'M')).toHaveLength(4)
    expect(forRaceSex(horns, 'tiefling', 'F')).toHaveLength(4)
    expect(forRaceSex(horns, 'human', 'M')).toHaveLength(0)
    expect(forRaceSex(horns, 'elf', 'F')).toHaveLength(0)
  })

  it('race-agnostic parts pass through for every race', () => {
    const generic: PartEntry[] = [{ id: 'GEN_Hair_X', label: 'X', path: '/x.glb' }]
    expect(forRaceSex(generic, 'tiefling', 'M')).toHaveLength(1)
    expect(forRaceSex(generic, 'human', 'F')).toHaveLength(1)
  })
})
