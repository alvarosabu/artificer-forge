import manifest from '#build/character-parts.mjs'
import { registerPartManifest } from '@artificer-forge/engine/runtime'

// Hand the generated part manifest (modules/part-manifest.ts) to the engine —
// the engine never hardcodes asset paths. Armor is intentionally absent: those
// assets resolve through item YAML (modular.assets).
export default defineNuxtPlugin(() => {
  registerPartManifest({
    rig: manifest.rig,
    parts: [
      ...manifest.bodies,
      ...manifest.heads,
      ...manifest.hair,
      ...manifest.beards,
      ...manifest.eyebrows,
      ...manifest.horns,
    ],
  })
})
