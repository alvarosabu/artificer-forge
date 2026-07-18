import { Color, type Texture } from 'three'
import { clamp, fract, mix, positionLocal, select, smoothstep, uniform, uv } from 'three/tsl'
import { MeshStandardNodeMaterial, MeshToonNodeMaterial } from 'three/webgpu'

// TSL material pair for tiefling horns (requires WebGPURenderer on the canvas).
// One shared colorNode drives both variants; everything is uniform-driven so
// pattern/color/weight changes never rebuild the material.

export type HornPattern = 'gradient' | 'repeated' | 'solid'
export const HORN_PATTERN_INDEX: Record<HornPattern, number> = { gradient: 0, repeated: 1, solid: 2 }

// Bands for the repeated variant — tuned to read as horn ridges.
const REPEATS = 6
// Softness half-width around the A→B split point.
const EDGE = 0.18

export interface HornUniforms {
  colorA: { value: Color }
  colorB: { value: Color }
  weight: { value: number }
  pattern: { value: number }
  // UV-space gradient bounds (v runs along the horn in the KayKit unwrap).
  vMin: { value: number }
  vMax: { value: number }
  // Bind-pose Y fallback for horns with collapsed UVs (TIF_Horns_D).
  posMin: { value: number }
  posMax: { value: number }
  useUv: { value: number } // 1 = uv.y coordinate, 0 = positionLocal.y fallback
}

export interface HornMaterialSet {
  std: MeshStandardNodeMaterial
  toon: MeshToonNodeMaterial
  uniforms: HornUniforms
}

// gradientMap is only used by the toon variant — std-only consumers (in-game
// rendering) can omit it.
export function createHornMaterials(gradientMap?: Texture): HornMaterialSet {
  const colorA = uniform(new Color('#2b2230'))
  const colorB = uniform(new Color('#8a6d5c'))
  const weight = uniform(0.5) // 0..1, where color A hands over to B
  const pattern = uniform(0) // HORN_PATTERN_INDEX, compared as float
  const vMin = uniform(0)
  const vMax = uniform(1)
  const posMin = uniform(0)
  const posMax = uniform(1)
  const useUv = uniform(1)

  // Length coordinate 0 (base) → 1 (tip). Primary source is uv.y normalized to
  // the mesh's own atlas region, which follows the horn's length even when it
  // curls. Horns with collapsed UVs fall back to bind-pose Y (positionLocal is
  // pre-skinning, so either way the gradient stays put while the head animates).
  const tUv = clamp(uv().y.sub(vMin).div(vMax.sub(vMin)), 0, 1)
  const tPos = clamp(positionLocal.y.sub(posMin).div(posMax.sub(posMin)), 0, 1)
  const t = select(useUv.greaterThan(0.5), tUv, tPos)

  const gradient = mix(colorA, colorB, smoothstep(weight.sub(EDGE), weight.add(EDGE), t))
  const repeated = mix(colorA, colorB, smoothstep(weight.sub(EDGE), weight.add(EDGE), fract(t.mul(REPEATS))))
  const colorNode = select(
    pattern.greaterThan(1.5),
    colorA, // solid
    select(pattern.greaterThan(0.5), repeated, gradient),
  )

  const std = new MeshStandardNodeMaterial({ roughness: 1, metalness: 0 })
  std.colorNode = colorNode
  std.name = 'Horns'

  const toon = new MeshToonNodeMaterial(gradientMap ? { gradientMap } : {})
  toon.colorNode = colorNode
  toon.name = 'Horns'

  return { std, toon, uniforms: { colorA, colorB, weight, pattern, vMin, vMax, posMin, posMax, useUv } }
}
