// Manifest of the modular character parts currently available under
// public/models/characters. Filenames are variable-field (KayKit naming, not the
// spec's fixed 4-field form), so entries are declared explicitly rather than parsed.
// meshNode === filename stem for every part.

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

const BASE = '/models/characters'

function stemLabel(stem: string): string {
  // Drop the GEN_/HUM_/TIF_ + sex prefixes, humanize the rest.
  return stem
    .replace(/^(GEN|HUM|TIF)_/, '')
    .replace(/^[MF]_/, '')
    .replace(/^(Hair|Beard|Eyebrows|Head)_/, '')
    .replace(/_/g, ' ')
}

function build(folder: string, stems: string[], sex?: Sex): PartEntry[] {
  return stems.map(id => ({ id, label: stemLabel(id), path: `${BASE}/${folder}/${id}.glb`, sex }))
}

export const BODIES: PartEntry[] = [
  { id: 'HUM_M_MEDIUM_Body_A', label: 'Human Male Medium', path: `${BASE}/bodies/HUM_M_MEDIUM_Body_A.glb`, sex: 'M' },
  { id: 'HUM_F_MEDIUM_Body_A', label: 'Human Female Medium', path: `${BASE}/bodies/HUM_F_MEDIUM_Body_A.glb`, sex: 'F' },
]

// Preload bridge: templateId links each asset to its item YAML; sexed items ship
// one fitted variant per body sex (resolve with armorForItem). Coverage (which
// body segments each hides) is read from the item YAML, not here.
export const ARMORS: PartEntry[] = [
  { id: 'ARM_M_MEDIUM_Leather_Jerkin', templateId: 'leather-jerkin', label: 'Leather Jerkin', path: `${BASE}/armors/ARM_M_MEDIUM_Leather_Jerkin.glb`, sex: 'M' },
  { id: 'ARM_F_MEDIUM_Leather_Jerkin', templateId: 'leather-jerkin', label: 'Leather Jerkin', path: `${BASE}/armors/ARM_F_MEDIUM_Leather_Jerkin.glb`, sex: 'F' },
  { id: 'common_pants', templateId: 'common-pants', label: 'Common Pants', path: `${BASE}/trousers/common_pants.glb` },
  { id: 'leather_sandals', templateId: 'leather-sandals', label: 'Leather Sandals', path: `${BASE}/boots/leather_sandals.glb` },
]

/** The item's fitted asset for this sex (unisex entries match any sex). */
export function armorForItem(templateId: string, sex: Sex): PartEntry | undefined {
  return ARMORS.find(a => a.templateId === templateId && (!a.sex || a.sex === sex))
}

// Tieflings borrow the elf heads for now. TODO: export dedicated TIF_ heads later.
export const HEADS: PartEntry[] = [
  { id: 'HUM_M_Head_A', label: 'Human Male A', path: `${BASE}/heads/HUM_M_Head_A.glb`, sex: 'M', race: ['human'] },
  { id: 'HUM_M_Head_B', label: 'Human Male B', path: `${BASE}/heads/HUM_M_Head_B.glb`, sex: 'M', race: ['human'] },
  { id: 'HUM_F_Head_A', label: 'Human Female A', path: `${BASE}/heads/HUM_F_Head_A.glb`, sex: 'F', race: ['human'] },
  { id: 'ELF_M_Head_A', label: 'Elf Male A', path: `${BASE}/heads/ELF_M_Head_A.glb`, sex: 'M', race: ['elf', 'tiefling'] },
  { id: 'ELF_F_Head_A', label: 'Elf Female A', path: `${BASE}/heads/ELF_F_Head_A.glb`, sex: 'F', race: ['elf', 'tiefling'] },
]

// Skinned like hair (weighted to the head bone), unisex, tiefling-only.
export const HORNS: PartEntry[] = ['TIF_Horns_A', 'TIF_Horns_B', 'TIF_Horns_C', 'TIF_Horns_D']
  .map(id => ({ id, label: stemLabel(id), path: `${BASE}/horns/${id}.glb`, race: ['tiefling'] as Race[] }))

export const HAIR: PartEntry[] = [
  ...build('hair', [
    'GEN_M_Hair_Short_A', 'GEN_M_Hair_Short_B', 'GEN_M_Hair_Short_C', 'GEN_M_Hair_Short_D',
    'GEN_M_Hair_Short_E', 'GEN_M_Hair_Short_F', 'GEN_M_Hair_Short_G', 'GEN_M_Hair_Short_H',
    'GEN_M_Hair_Short_I', 'GEN_M_Hair_Short_J', 'GEN_M_Hair_Medium_A', 'GEN_M_Hair_Medium_B',
    'GEN_M_Hair_Long_A', 'GEN_M_Hair_Long_B', 'GEN_M_Hair_Long_C', 'GEN_M_Hair_Long_D',
  ], 'M'),
  ...build('hair', [
    'GEN_F_Hair_Short_A', 'GEN_F_Hair_Medium_A', 'GEN_F_Hair_Medium_B', 'GEN_F_Hair_Medium_C',
    'GEN_F_Hair_Medium_D', 'GEN_F_Hair_Medium_E',
    'GEN_F_Hair_Long_A', 'GEN_F_Hair_Long_B', 'GEN_F_Hair_Long_C', 'GEN_F_Hair_Long_D',
  ], 'F'),
]

export const BEARDS: PartEntry[] = build('beards', [
  'GEN_Beard_Sideburns', 'GEN_Beard_GoateeMustache', 'GEN_Beard_Short_A',
  'GEN_Beard_Medium_A', 'GEN_Beard_Medium_B', 'GEN_Beard_Long_A',
])

export const EYEBROWS: PartEntry[] = build('eyebrows', [
  'GEN_Eyebrows_Thin_A', 'GEN_Eyebrows_Thin_B', 'GEN_Eyebrows_Thin_C', 'GEN_Eyebrows_Thin_D',
  'GEN_Eyebrows_Thin_E', 'GEN_Eyebrows_Thin_F', 'GEN_Eyebrows_Thin_G',
  'GEN_Eyebrows_Thick_A', 'GEN_Eyebrows_Thick_B', 'GEN_Eyebrows_Thick_C', 'GEN_Eyebrows_Thick_D',
])

export const RIG_MEDIUM = `${BASE}/rig_medium.glb`

/** Parts whose `sex` is undefined (unisex) or matches the given sex. */
export function forSex(parts: PartEntry[], sex: Sex): PartEntry[] {
  return parts.filter(p => !p.sex || p.sex === sex)
}

/** forSex, additionally narrowed to parts matching the race (or race-agnostic). */
export function forRaceSex(parts: PartEntry[], race: Race, sex: Sex): PartEntry[] {
  return forSex(parts, sex).filter(p => !p.race || p.race.includes(race))
}
