import { describe, expect, it } from 'vitest'
import type { CustomizationState } from '../composables/useCharacterCustomization'
import { customizationToTemplateYaml } from '../utils/customizationToTemplateYaml'

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
  equipment: { helmet: null, armor: 'leather-jerkin', cloak: null, trousers: 'common-pants', gauntlets: null, boots: null },
  equipmentTint: { armor: 'crimson' },
  skinColor: '#CE4C47',
  hairColor: '#3b2417',
  toon: true,
  nude: true,
}

describe('customizationToTemplateYaml', () => {
  it('derives templateId/filename from the name (kebab-case)', () => {
    const { filename, yaml } = customizationToTemplateYaml(STATE, 'Sir Reginald III')
    expect(filename).toBe('sir-reginald-iii.yaml')
    expect(yaml).toContain('templateId: sir-reginald-iii')
    expect(yaml).toContain('name: Sir Reginald III')
  })

  it('falls back to custom-character when the name is blank', () => {
    const { filename, yaml } = customizationToTemplateYaml(STATE, '  ')
    expect(filename).toBe('custom-character.yaml')
    expect(yaml).toContain('templateId: custom-character')
    expect(yaml).toContain('name: Custom Character')
  })

  it('emits a full playable template with defaults', () => {
    const { yaml } = customizationToTemplateYaml(STATE, 'Tav')
    expect(yaml).toContain('type: character')
    expect(yaml).toContain('class: fighter')
    expect(yaml).toContain('level: 1')
    expect(yaml).toContain('race: tiefling')
    expect(yaml).toContain('sex: F')
    expect(yaml).toContain('  hp: 38')
    expect(yaml).toContain('team: player')
    expect(yaml).toContain('controllable: true')
    expect(yaml).toContain('  behavior: companion')
    expect(yaml).toContain('portrait: /img/portraits/hero_portrait.png')
    expect(yaml).toContain('  - arrow-shot')
    expect(yaml).toContain('  - cloak')
  })

  it('serializes appearance with quoted hex colors, explicit nulls and horn params', () => {
    const { yaml } = customizationToTemplateYaml(STATE, 'Tav')
    expect(yaml).toContain('  body: HUM_F_MEDIUM_Body_A')
    expect(yaml).toContain('  beard: null')
    expect(yaml).toContain("  skinColor: '#CE4C47'")
    expect(yaml).toContain("  hairColor: '#3b2417'")
    expect(yaml).toContain("  hornColorA: '#2b2230'")
    expect(yaml).toContain('  hornPattern: repeated')
    expect(yaml).toContain('  hornWeight: 0.7')
    expect(yaml).toContain('  equipmentTint:')
    expect(yaml).toContain('    armor: crimson')
  })

  it('omits horn params when no horns, and equipmentTint when empty', () => {
    const { yaml } = customizationToTemplateYaml({ ...STATE, horns: null, equipmentTint: {} }, 'Tav')
    expect(yaml).toContain('  horns: null')
    expect(yaml).not.toContain('hornPattern')
    expect(yaml).not.toContain('equipmentTint')
  })

  it('includes only equipped (non-null) slots in equipment', () => {
    const { yaml } = customizationToTemplateYaml(STATE, 'Tav')
    const equipment = yaml.slice(yaml.indexOf('equipment:\n'))
    expect(equipment).toContain('  armor: leather-jerkin')
    expect(equipment).toContain('  trousers: common-pants')
    expect(equipment).not.toContain('helmet')
    expect(equipment).not.toContain('boots')
  })
})
