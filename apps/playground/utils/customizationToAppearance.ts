import type { CharacterAppearance } from '@artificer-forge/engine/core'
import type { CustomizationState } from '../composables/useCharacterCustomization'
import type { Race, Sex } from './partManifest'

// Maps customizer lab state → the engine's entity fields. This is what a
// future "Play" flow spawns from (spawnFromTemplate overrides). toon/nude/
// equipment don't travel — equipment becomes real inventory items on spawn,
// the rest is lab-only.
export function customizationToAppearance(state: CustomizationState): { race: Race, sex: Sex, appearance: CharacterAppearance } {
  return {
    race: state.race,
    sex: state.sex,
    appearance: {
      body: state.body!,
      head: state.head!,
      hair: state.hair,
      beard: state.beard,
      eyebrows: state.eyebrows,
      accessory: state.accessory,
      horns: state.horns,
      skinColor: state.skinColor,
      hairColor: state.hairColor,
      ...(state.horns && {
        hornColorA: state.hornColorA,
        hornColorB: state.hornColorB,
        hornPattern: state.hornPattern,
        hornWeight: state.hornWeight,
      }),
      equipmentTint: { ...state.equipmentTint },
    },
  }
}
