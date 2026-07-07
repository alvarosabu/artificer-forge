// Pure part-manifest domain: types, filename parser, and filter helpers.
// No #build imports — unit-testable and consumed by both the build-time scanner
// (modules/part-manifest.ts) and the runtime re-export layer (characterParts.ts).

export type Sex = 'M' | 'F'
export type Race = 'human' | 'elf' | 'tiefling'

export interface PartEntry {
  id: string // filename stem, doubles as the mesh node name
  label: string
  path: string
  sex?: Sex // omitted = unisex
  race?: Race[] // omitted = any race (GEN_ parts, shared bodies)
  templateId?: string // armor only: the item templateId this asset renders
}

export type PartOverride = Partial<Pick<PartEntry, 'label' | 'sex' | 'race'>>

export const SLOT_FOLDERS = ['bodies', 'heads', 'hair', 'beards', 'eyebrows', 'horns'] as const
export type SlotFolder = typeof SLOT_FOLDERS[number]

const RACE_PREFIX: Record<string, Race[] | undefined> = {
  HUM: ['human'],
  ELF: ['elf'],
  TIF: ['tiefling'],
  GEN: undefined, // any race
}

const RACE_LABEL: Record<Race, string> = { human: 'Human', elf: 'Elf', tiefling: 'Tiefling' }
const SEX_LABEL: Record<Sex, string> = { M: 'Male', F: 'Female' }

// Variable-field KayKit names, but the leading fields are stable:
// {RACE}_{SEX?}_… — race prefix first, sex (when present) always the second
// token. Positional sex parsing keeps trailing variant letters (…_Short_F)
// and MEDIUM from reading as a sex. Returns null for stems outside the
// convention (caller warns).
export function parsePart(stem: string, folder: SlotFolder, overrides: Record<string, PartOverride> = {}): PartEntry | null {
  const tokens = stem.split('_')
  const prefix = tokens[0]!
  if (!(prefix in RACE_PREFIX)) return null

  const sex: Sex | undefined = tokens[1] === 'M' || tokens[1] === 'F' ? tokens[1] : undefined
  const race = RACE_PREFIX[prefix]

  // Label: drop the race/sex/slot tokens, title-case the rest; sexed race parts
  // get a "Human Male …" prefix so heads/bodies read naturally in pickers.
  const rest = tokens
    .slice(sex ? 2 : 1)
    .filter(t => !/^(Hair|Beard|Eyebrows|Head|Body|Horns)$/.test(t))
    .map(t => t[0]! + t.slice(1).toLowerCase())
    .join(' ')
  const label = race && sex ? [RACE_LABEL[race[0]!], SEX_LABEL[sex], rest].filter(Boolean).join(' ') : rest || stem

  return {
    id: stem,
    label,
    path: `/models/characters/${folder}/${stem}.glb`,
    ...(sex && { sex }),
    ...(race && { race }),
    ...overrides[stem],
  }
}

/** Parts whose `sex` is undefined (unisex) or matches the given sex. */
export function forSex(parts: PartEntry[], sex: Sex): PartEntry[] {
  return parts.filter(p => !p.sex || p.sex === sex)
}

/** forSex, additionally narrowed to parts matching the race (or race-agnostic). */
export function forRaceSex(parts: PartEntry[], race: Race, sex: Sex): PartEntry[] {
  return forSex(parts, sex).filter(p => !p.race || p.race.includes(race))
}
