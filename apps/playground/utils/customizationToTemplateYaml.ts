import type { CustomizationState, EquipSlot } from '../composables/useCharacterCustomization'
import { customizationToAppearance } from './customizationToAppearance'

// Hand-rolled emitter: the template shape is fixed and we want cedric.yaml-style
// section grouping and comments, which a generic YAML serializer can't produce.

const DEFAULT_STATS: [string, number][] = [
  ['hp', 38],
  ['maxHp', 38],
  ['ac', 14],
  ['strength', 12],
  ['dexterity', 16],
  ['constitution', 12],
  ['intelligence', 10],
  ['wisdom', 14],
  ['charisma', 10],
  ['maxActions', 1],
  ['maxBonusActions', 1],
]

const DEFAULT_ABILITIES = ['arrow-shot', 'magic-missile', 'fireball']

const EQUIPMENT_SLOTS = [
  'mainHand', 'offHand', 'helmet', 'armor', 'cloak', 'trousers',
  'gauntlets', 'boots', 'amulet', 'ring1', 'ring2',
]

function kebabCase(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Hex colors start with '#' (a YAML comment) so they must be quoted.
function scalar(value: string | number | boolean | null): string {
  if (value === null) return 'null'
  if (typeof value !== 'string') return String(value)
  return /[:#'"]/.test(value) ? `'${value.replace(/'/g, '\'\'')}'` : value
}

export function customizationToTemplateYaml(state: CustomizationState, name: string) {
  const displayName = name.trim() || 'Custom Character'
  const templateId = kebabCase(name) || 'custom-character'
  const { race, sex, appearance } = customizationToAppearance(state)

  const appearanceLines = Object.entries(appearance)
    .filter(([key]) => key !== 'equipmentTint')
    .map(([key, value]) => `  ${key}: ${scalar(value as string | number | null)}`)
  const tints = Object.entries(appearance.equipmentTint ?? {})
  if (tints.length) {
    appearanceLines.push('  equipmentTint:')
    appearanceLines.push(...tints.map(([slot, tint]) => `    ${slot}: ${scalar(tint)}`))
  }

  const equipped = (Object.entries(state.equipment) as [EquipSlot, string | null][])
    .filter(([, id]) => id !== null)

  const yaml = [
    `templateId: ${scalar(templateId)}`,
    'type: character',
    `name: ${scalar(displayName)}`,
    'class: fighter',
    'level: 1',
    `race: ${race}`,
    `sex: ${sex}`,
    '',
    'stats:',
    ...DEFAULT_STATS.map(([key, value]) => `  ${key}: ${value}`),
    '',
    'team: player',
    'controllable: true',
    '',
    'ai:',
    '  behavior: companion',
    '  followDistance: 3',
    '',
    '# Static portrait: live baking renders entity.model, which modular characters',
    '# don\'t have. Reusing the hero art until a dedicated portrait exists.',
    'portrait: /img/portraits/hero_portrait.png',
    'portraitBackground: /img/portraits/bgs/blue-storm.png',
    '',
    '# Modular character: no `model` — assembled from parts on the shared rig.',
    'appearance:',
    ...appearanceLines,
    '',
    'abilities:',
    ...DEFAULT_ABILITIES.map(id => `  - ${id}`),
    '',
    'equipmentSlots:',
    ...EQUIPMENT_SLOTS.map(slot => `  - ${slot}`),
    '',
    'equipment:',
    ...equipped.map(([slot, id]) => `  ${slot}: ${id}`),
    '',
  ].join('\n')

  return { filename: `${templateId}.yaml`, yaml }
}
