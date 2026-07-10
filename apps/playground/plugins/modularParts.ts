import { MeshStandardMaterial } from 'three'
import manifest from '#build/character-parts.mjs'
import { registerPartManifest, registerSegmentMaterials } from '@artificer-forge/engine/runtime'
import { ghostMaterial, type GhostMaterialOptions } from '@artificer-forge/vfx'

// Hand the generated part manifest (modules/part-manifest.ts) to the engine —
// the engine never hardcodes asset paths. Armor is intentionally absent: those
// assets resolve through item YAML (modular.assets).
export default defineNuxtPlugin(() => {
  registerPartManifest({
    rigs: manifest.rigs,
    parts: [
      ...manifest.bodies,
      ...manifest.heads,
      ...manifest.hair,
      ...manifest.beards,
      ...manifest.eyebrows,
      ...manifest.horns,
    ],
  })

  // Materials available to appearance.segmentMaterials (Cedric's ghost arm).
  // The ghost shader is TSL — WebGPU only; WebGL scenes get a translucent tint.
  registerSegmentMaterials({
    ghost: (params, { isWebGPU }) => {
      const opts = (params ?? {}) as GhostMaterialOptions
      if (isWebGPU) return ghostMaterial(opts).material
      const fallback = new MeshStandardMaterial({
        color: opts.color ?? '#88ccff',
        transparent: true,
        opacity: 0.55,
        roughness: 0.35,
        depthWrite: false,
      })
      fallback.name = 'GhostFallback'
      return fallback
    },
  })
})
