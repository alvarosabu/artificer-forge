import type { Material } from 'three'

// App-injected material factories for appearance.segmentMaterials (same
// injection pattern as the part manifest: the engine never hardcodes shaders).
// Factories receive the override's params and the renderer context — node
// (TSL) materials only run on WebGPU, so the app decides its own fallback.

export type SegmentMaterialFactory = (
  params: Record<string, unknown> | undefined,
  ctx: { isWebGPU: boolean },
) => Material

const factories = new Map<string, SegmentMaterialFactory>()

export function registerSegmentMaterials(map: Record<string, SegmentMaterialFactory>) {
  for (const [name, factory] of Object.entries(map)) factories.set(name, factory)
}

export function resolveSegmentMaterial(name: string): SegmentMaterialFactory | undefined {
  return factories.get(name)
}

/** Body-segment matcher for a segment key. Sided keys (`armR`, `handL`) match
 * exactly one side; side-agnostic keys (`arm`, `torso`) match both. Matches
 * body-group child names like HUM_M_ArmR_A. */
export function segmentMatcher(key: string): RegExp {
  const token = key[0]!.toUpperCase() + key.slice(1)
  return /[LR]$/.test(token)
    ? new RegExp(`_${token}(_|$)`)
    : new RegExp(`_${token}(L|R)?(_|$)`)
}
