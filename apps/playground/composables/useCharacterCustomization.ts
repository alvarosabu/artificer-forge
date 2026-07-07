import { computed, reactive, watch } from 'vue'
import { BEARDS, BODIES, EYEBROWS, forRaceSex, forSex, HAIR, HEADS, HORNS, type Race, type Sex } from '../utils/characterParts'
import type { HornPattern } from '../utils/hornMaterial'

export type EquipSlot = 'helmet' | 'armor' | 'trousers' | 'gauntlets' | 'boots'

export interface CustomizationState {
  race: Race
  sex: Sex
  body: string | null
  head: string | null
  hair: string | null
  beard: string | null
  eyebrows: string | null
  // Tiefling-only slot + its TSL material controls (ignored for other races).
  horns: string | null
  hornColorA: string
  hornColorB: string
  hornPattern: HornPattern
  hornWeight: number // 0..1, split point where color A hands over to B
  // Equipped gear by slot (item templateId). Defaults will later be driven by the
  // selected class; for now a single starter piece is equipped.
  equipment: Record<EquipSlot, string | null>
  // Selected palette-atlas tint id per slot; absent = the item's base/default atlas.
  equipmentTint: Partial<Record<EquipSlot, string>>
  skinColor: string
  hairColor: string
  toon: boolean
  // Preview-only: hide all equipped gear to inspect the bare body. Equipment
  // selections are kept, so toggling off re-dresses the character.
  nude: boolean
}

const DEFAULT_HAIR_COLOR = '#3b2417'
const DEFAULT_SKIN_COLOR = '#eecbb0' // fair skin

// Switching race snaps skin to the race default (BG3-style predictability).
const RACE_DEFAULT_SKIN: Record<Race, string> = {
  human: DEFAULT_SKIN_COLOR,
  elf: DEFAULT_SKIN_COLOR,
  tiefling: '#CE4C47',
}

const DEFAULT_HORN_COLOR_A = '#2b2230'
const DEFAULT_HORN_COLOR_B = '#8a6d5c'

const defaultBody = (sex: Sex) => forSex(BODIES, sex)[0]?.id ?? null
const defaultHead = (race: Race, sex: Sex) => forRaceSex(HEADS, race, sex)[0]?.id ?? null
const defaultHair = (sex: Sex) => forSex(HAIR, sex)[0]?.id ?? null

// Single-page lab state — not a global singleton; the create page owns one instance.
export function useCharacterCustomization() {
  const state = reactive<CustomizationState>({
    race: 'human',
    sex: 'M',
    body: defaultBody('M'),
    head: defaultHead('human', 'M'),
    hair: defaultHair('M'),
    beard: null,
    eyebrows: EYEBROWS[0]?.id ?? null,
    horns: null,
    hornColorA: DEFAULT_HORN_COLOR_A,
    hornColorB: DEFAULT_HORN_COLOR_B,
    hornPattern: 'gradient',
    hornWeight: 0.5,
    equipment: { helmet: null, armor: 'leather-jerkin', trousers: 'common-pants', gauntlets: null, boots: 'leather-sandals' },
    equipmentTint: {},
    skinColor: DEFAULT_SKIN_COLOR,
    hairColor: DEFAULT_HAIR_COLOR,
    toon: false,
    nude: false,
  })

  const bodyOptions = computed(() => forSex(BODIES, state.sex))
  const heads = computed(() => forRaceSex(HEADS, state.race, state.sex))
  const hairOptions = computed(() => forSex(HAIR, state.sex))
  const beardOptions = computed(() => (state.sex === 'M' ? BEARDS : []))
  const eyebrowOptions = computed(() => EYEBROWS)
  const hornOptions = computed(() => forRaceSex(HORNS, state.race, state.sex))

  // Switching sex re-points sex-specific slots to valid options.
  watch(() => state.sex, (sex) => {
    state.body = defaultBody(sex)
    state.head = defaultHead(state.race, sex)
    // Keep the current hair if it's valid for this sex, else fall back to a default.
    if (!state.hair || !hairOptions.value.some(h => h.id === state.hair)) state.hair = defaultHair(sex)
    if (sex === 'F') state.beard = null
  })

  // Races share the body/hair/etc. (GEN_ parts); only the head is race-specific.
  // Skin snaps to the race default, horns exist only while tiefling is selected.
  watch(() => state.race, (race) => {
    state.head = defaultHead(race, state.sex)
    state.skinColor = RACE_DEFAULT_SKIN[race]
    state.horns = race === 'tiefling' ? HORNS[0]?.id ?? null : null
  })

  return { state, bodyOptions, heads, hairOptions, beardOptions, eyebrowOptions, hornOptions }
}
