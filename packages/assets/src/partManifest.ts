// Pure part-manifest domain: types, filename parser, and filter helpers.
// No fs/#build imports — unit-testable and consumed by both the build-time
// scanner (src/scan.ts) and app code via the package root export.

export type Sex = 'M' | 'F'
export type Race = 'human' | 'elf' | 'tiefling' | 'goblin'
export type RigKey = 'medium' | 'small'

export interface PartEntry {
  id: string // filename stem, doubles as the mesh node name
  label: string
  path: string
  sex?: Sex // omitted = unisex
  race?: Race[] // omitted = any race (GEN_ parts, shared bodies)
  rig?: RigKey // bodies only: skeleton the body (and thus the character) binds to
  templateId?: string // armor only: the item templateId this asset renders
}

export type PartOverride = Partial<Pick<PartEntry, 'label' | 'sex' | 'race'>>

export const SLOT_FOLDERS = ['bodies', 'heads', 'hair', 'beards', 'eyebrows', 'horns', 'accessories'] as const
export type SlotFolder = typeof SLOT_FOLDERS[number]

const RACE_PREFIX: Record<string, Race[] | undefined> = {
  HUM: ['human'],
  ELF: ['elf'],
  TIF: ['tiefling'],
  GOB: ['goblin'],
  GEN: undefined, // any race
}

// Skeleton each race binds to. GEN_ parts are authored on the medium rig, so
// "race-agnostic" really means "any medium-rig race" — small-rig races only
// fit parts explicitly tagged for them.
export const RACE_RIG: Record<Race, RigKey> = {
  human: 'medium',
  elf: 'medium',
  tiefling: 'medium',
  goblin: 'small',
}

const RACE_LABEL: Record<Race, string> = { human: 'Human', elf: 'Elf', tiefling: 'Tiefling', goblin: 'Goblin' }
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
  // Bodies pin the skeleton: an ALL-CAPS size token (HUM_M_MEDIUM_…,
  // GOB_F_SMALL_…) names the rig; absent = medium. Title-case Medium/Small in
  // other slots stays a plain variant word.
  const rig: RigKey | undefined = folder === 'bodies'
    ? tokens.includes('SMALL') ? 'small' : 'medium'
    : undefined

  // Label: drop the race/sex/slot/size tokens, title-case the rest; sexed race
  // parts get a "Human Male …" prefix so heads/bodies read naturally in pickers.
  const rest = tokens
    .slice(sex ? 2 : 1)
    .filter(t => !/^(Hair|Beard|Eyebrows|Head|Body|Horns|SMALL|MEDIUM)$/.test(t))
    .map(t => t[0]! + t.slice(1).toLowerCase())
    .join(' ')
  const label = race && sex ? [RACE_LABEL[race[0]!], SEX_LABEL[sex], rest].filter(Boolean).join(' ') : rest || stem

  return {
    id: stem,
    label,
    path: `/models/characters/${folder}/${stem}.glb`,
    ...(sex && { sex }),
    ...(race && { race }),
    ...(rig && { rig }),
    ...overrides[stem],
  }
}

/** Parts whose `sex` is undefined (unisex) or matches the given sex. */
export function forSex(parts: PartEntry[], sex: Sex): PartEntry[] {
  return parts.filter(p => !p.sex || p.sex === sex)
}

/**
 * forSex, additionally narrowed by race. Race-tagged parts must include the
 * race; untagged (GEN_) parts fit medium-rig races only — see RACE_RIG.
 */
export function forRaceSex(parts: PartEntry[], race: Race, sex: Sex): PartEntry[] {
  return forSex(parts, sex).filter(p => p.race ? p.race.includes(race) : RACE_RIG[race] === 'medium')
}
