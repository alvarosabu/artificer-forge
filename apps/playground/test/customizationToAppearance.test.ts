import { describe, expect, it } from 'vitest'
import type { CustomizationState } from '../composables/useCharacterCustomization'
import { customizationToAppearance } from '../utils/customizationToAppearance'

const STATE: CustomizationState = {
  race: 'tiefling',
  sex: 'F',
  body: 'HUM_F_MEDIUM_Body_A',
  head: 'ELF_F_Head_A',
  hair: 'GEN_F_Hair_Long_A',
  beard: null,
  eyebrows: 'GEN_Eyebrows_Thin_A',
  horns: 'TIF_Horns_B',
  hornColorA: '#2b2230',
  hornColorB: '#8a6d5c',
  hornPattern: 'repeated',
  hornWeight: 0.7,
  equipment: { helmet: null, armor: 'leather-jerkin', cloak: null, trousers: null, gauntlets: null, boots: null },
  equipmentTint: { armor: 'crimson' },
  skinColor: '#CE4C47',
  hairColor: '#3b2417',
  toon: true,
  nude: true,
}

describe('customizationToAppearance', () => {
  it('maps lab state to entity fields; lab-only toggles do not travel', () => {
    const { race, sex, appearance } = customizationToAppearance(STATE)
    expect(race).toBe('tiefling')
    expect(sex).toBe('F')
    expect(appearance).toEqual({
      body: 'HUM_F_MEDIUM_Body_A',
      head: 'ELF_F_Head_A',
      hair: 'GEN_F_Hair_Long_A',
      beard: null,
      eyebrows: 'GEN_Eyebrows_Thin_A',
      horns: 'TIF_Horns_B',
      skinColor: '#CE4C47',
      hairColor: '#3b2417',
      hornColorA: '#2b2230',
      hornColorB: '#8a6d5c',
      hornPattern: 'repeated',
      hornWeight: 0.7,
      equipmentTint: { armor: 'crimson' },
    })
    expect('toon' in appearance).toBe(false)
    expect('equipment' in appearance).toBe(false)
  })

  it('omits horn params when no horns are attached', () => {
    const { appearance } = customizationToAppearance({ ...STATE, horns: null })
    expect(appearance.horns).toBeNull()
    expect(appearance.hornPattern).toBeUndefined()
  })
})
