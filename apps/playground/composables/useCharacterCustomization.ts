import { computed, reactive, watch } from 'vue'
import { BEARDS, BODIES, EYEBROWS, HAIR, HEADS, HORNS } from '../utils/characterParts'
import { forRaceSex, type Race, type Sex } from '../utils/partManifest'
import type { HornPattern } from '@artificer-forge/vfx'

export type EquipSlot = 'helmet' | 'armor' | 'cloak' | 'trousers' | 'gauntlets' | 'boots'

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
  // Preview-only: overlay the rig bones (SkeletonHelper) on the character.
  skeleton: boolean
}

const DEFAULT_HAIR_COLOR = '#3b2417'
const DEFAULT_SKIN_COLOR = '#eecbb0' // fair skin

// Switching race snaps skin to the race default (BG3-style predictability).
const RACE_DEFAULT_SKIN: Record<Race, string> = {
  human: DEFAULT_SKIN_COLOR,
  elf: DEFAULT_SKIN_COLOR,
  tiefling: '#CE4C47',
  goblin: '#7C9C46',
}

const DEFAULT_HORN_COLOR_A = '#2b2230'
const DEFAULT_HORN_COLOR_B = '#8a6d5c'

const defaultBody = (race: Race, sex: Sex) => forRaceSex(BODIES, race, sex)[0]?.id ?? null
const defaultHead = (race: Race, sex: Sex) => forRaceSex(HEADS, race, sex)[0]?.id ?? null
const defaultHair = (race: Race, sex: Sex) => forRaceSex(HAIR, race, sex)[0]?.id ?? null
const defaultEyebrows = (race: Race, sex: Sex) => forRaceSex(EYEBROWS, race, sex)[0]?.id ?? null

// Single-page lab state — not a global singleton; the create page owns one instance.
export function useCharacterCustomization() {
  const state = reactive<CustomizationState>({
    race: 'human',
    sex: 'M',
    body: defaultBody('human', 'M'),
    head: defaultHead('human', 'M'),
    hair: defaultHair('human', 'M'),
    beard: null,
    eyebrows: defaultEyebrows('human', 'M'),
    horns: null,
    hornColorA: DEFAULT_HORN_COLOR_A,
    hornColorB: DEFAULT_HORN_COLOR_B,
    hornPattern: 'gradient',
    hornWeight: 0.5,
    equipment: { helmet: null, armor: 'leather-jerkin', cloak: null, trousers: 'common-pants', gauntlets: null, boots: 'leather-sandals' },
    equipmentTint: {},
    skinColor: DEFAULT_SKIN_COLOR,
    hairColor: DEFAULT_HAIR_COLOR,
    toon: false,
    nude: false,
    skeleton: false,
  })

  const bodyOptions = computed(() => forRaceSex(BODIES, state.race, state.sex))
  const heads = computed(() => forRaceSex(HEADS, state.race, state.sex))
  const hairOptions = computed(() => forRaceSex(HAIR, state.race, state.sex))
  const beardOptions = computed(() => (state.sex === 'M' ? forRaceSex(BEARDS, state.race, 'M') : []))
  const eyebrowOptions = computed(() => forRaceSex(EYEBROWS, state.race, state.sex))
  const hornOptions = computed(() => forRaceSex(HORNS, state.race, state.sex))

  // Keep the current part if it's still offered, else fall back to a default.
  function revalidateParts() {
    if (!state.hair || !hairOptions.value.some(h => h.id === state.hair)) state.hair = defaultHair(state.race, state.sex)
    if (state.eyebrows && !eyebrowOptions.value.some(e => e.id === state.eyebrows)) state.eyebrows = defaultEyebrows(state.race, state.sex)
    if (state.beard && !beardOptions.value.some(b => b.id === state.beard)) state.beard = null
  }

  // Switching sex re-points sex-specific slots to valid options.
  watch(() => state.sex, (sex) => {
    state.body = defaultBody(state.race, sex)
    state.head = defaultHead(state.race, sex)
    revalidateParts()
    if (sex === 'F') state.beard = null
  })

  // Medium races share bodies/hair (GEN_ parts); small races bring their own,
  // so body and race-locked parts re-resolve. Skin snaps to the race default,
  // horns exist only while tiefling is selected.
  watch(() => state.race, (race) => {
    state.body = defaultBody(race, state.sex)
    state.head = defaultHead(race, state.sex)
    revalidateParts()
    state.skinColor = RACE_DEFAULT_SKIN[race]
    state.horns = race === 'tiefling' ? HORNS[0]?.id ?? null : null
  })

  return { state, bodyOptions, heads, hairOptions, beardOptions, eyebrowOptions, hornOptions }
}
