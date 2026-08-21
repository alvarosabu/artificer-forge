import { Fn, mix, mx_noise_float, mx_noise_vec3, normalWorld, positionWorld, rotateUV, smoothstep, texture, uniform } from 'three/tsl'
import { Color } from 'three'
import { MeshLambertNodeMaterial, RepeatWrapping, SRGBColorSpace, Texture } from 'three/webgpu'
import { controlUv, type ControlMap } from './controlMap'
import type { GradingContext } from '../grading/grading'
import { createDropShadowCatcher, stylizedOutput } from '../grading/stylizedOutput'

/**
 * Every tweakable of the terrain material, one uniform each. Created per
 * material so two terrains can be graded differently, and so a debug panel can
 * write straight into `.value` without rebuilding the node graph.
 *
 * Each surface carries two sets of colour: the dark/light pair is the gradient
 * used when that surface has NO map, and the tint multiplies the map when it
 * does. Only one of the two is ever live, decided by which maps you pass to
 * buildTerrainMaterial.
 *
 * Noise frequencies are cycles per world metre, so 1 / freq is the feature size.
 * Anything past ~1 is smaller than a metre, which is sub-pixel at level-overview
 * distance and reads as static instead of material.
 */
export function createTerrainUniforms() {
  return {
    groundDark: uniform(new Color('#7d5f3e')),
    groundLight: uniform(new Color('#a8834f')),
    /** multiplies the tiled map; white = the texture as authored */
    groundTint: uniform(new Color('#ffffff')),
    groundTile: uniform(0.1), // one tile per 10 metres
    groundWarp: uniform(3.0),
    // gravel sat ~18 lightness points apart, which at grain scale reads as
    // salt-and-pepper rather than stone — a tighter pair still breaks up flat
    roadDark: uniform(new Color('#7a7264')),
    roadLight: uniform(new Color('#98907f')),
    roadTint: uniform(new Color('#ffffff')),
    roadTile: uniform(0.25), // one tile per 4 metres
    roadWarp: uniform(2.0),
    /** control-map value where road starts and finishes taking over */
    roadBlendLow: uniform(0.25),
    roadBlendHigh: uniform(0.6),
    grassDark: uniform(new Color('#90b070')),
    grassLight: uniform(new Color('#b0c890')),
    grassTint: uniform(new Color('#ffffff')),
    grassTile: uniform(0.25), // one tile per 4 metres
    grassWarp: uniform(2.0),
    grassBlendLow: uniform(0.25),
    grassBlendHigh: uniform(0.6),
    rockDark: uniform(new Color('#5b5a5f')),
    rockLight: uniform(new Color('#8d8b90')),
    rockTint: uniform(new Color('#ffffff')),
    rockTile: uniform(0.1), // one tile per 10 metres
    rockWarp: uniform(3.0),
    /** normal.y where rock starts taking over, and where it fully wins */
    slopeStart: uniform(0.62),
    slopeEnd: uniform(0.82),
    wetGround: uniform(new Color('#4a3a28')),
    /** blue-channel band the shore darkening ramps across */
    shoreLow: uniform(0.05),
    shoreHigh: uniform(0.6),
    /** how hard the fine noise bites into a painted edge; 0 = clean brush line */
    edgeStrength: uniform(0.5),
    grainFreq: uniform(0.35), // ~3m — surface break-up and painted-edge wobble
    patchFreq: uniform(0.06), // ~17m — broad tonal drift, the thing that reads as terrain
    rockFreq: uniform(0.5), //   ~2m — stone is finer than soil, but not per-metre fine
    warpFreq: uniform(0.04), // ~25m — the scale the tile grid gets bent at
  }
}

export type TerrainUniforms = ReturnType<typeof createTerrainUniforms>

// perlin noise in world metres, remapped from [-1, 1] to [0, 1]
const worldNoise = Fn(([frequency]: [any]) => {
  return mx_noise_float(positionWorld.xz.mul(frequency)).mul(0.5).add(0.5)
})

// A plain function, not Fn(): a Texture is CPU state, and Fn parameters can only
// carry nodes. This inlines into the graph exactly the same way.
//
// Two tricks against visible tiling: warp the lookup so the grid lines bend, then
// cross two grids at 0.61 scale and 0.9 rad, which never align with each other.
function tiledColor(map: Texture, tile: any, warpAmount: any, warpFrequency: any) {
  const warp = mx_noise_vec3(positionWorld.xz.mul(warpFrequency)).xy.mul(warpAmount)
  const uv = positionWorld.xz.add(warp).mul(tile)
  const a = texture(map, uv).rgb
  const b = texture(map, rotateUV(uv, 0.9).mul(0.61)).rgb
  return mix(a, b, 0.5)
}

// world-projected albedo, so tiling ignores whatever UVs the level GLB carries
function prepareSurfaceMap(map: Texture) {
  map.colorSpace = SRGBColorSpace
  // world XZ passes 1 within a metre, so clamping streaks the last row of pixels
  map.wrapS = RepeatWrapping
  map.wrapT = RepeatWrapping
  // the ground is mostly seen at grazing angles, so > 1 pays off
  map.anisotropy = 4
  map.needsUpdate = true
}

export function buildTerrainMaterial(options: {
  control: ControlMap
  grading?: GradingContext | null
  grassMap?: Texture
  groundMap?: Texture
  roadMap?: Texture
  rockMap?: Texture
  /** pass one in to tune the look live; omitted, the material makes its own */
  uniforms?: TerrainUniforms
}) {
  // Lambert even on the graded path: the lighting result is discarded by the
  // finish, the material is lit only so the shadow catcher runs (see stylizedOutput)
  const material = new MeshLambertNodeMaterial()
  const { control, grading, grassMap, groundMap, roadMap, rockMap } = options
  const u = options.uniforms ?? createTerrainUniforms()
  const data = texture(control.texture, controlUv(control.uniforms, positionWorld.xz))

  // texture settings are CPU state: set them once here, never inside the Fn below
  for (const map of [groundMap, grassMap, roadMap, rockMap]) {
    if (map) prepareSurfaceMap(map)
  }

  const surfaceColor = Fn(() => {
    const grain = worldNoise(u.grainFreq).toVar()
    const patches = worldNoise(u.patchFreq)
    // patch-dominated: the coarse field carries the tonal variation, grain only
    // dithers it. The reverse (equal weight) is what made the surface fizz.
    const tone = mix(grain, patches, 0.75).toVar()
    // fine noise eats into painted edges so a brushed border reads as irregular.
    // Centred on the grain midpoint, so turning the strength up widens the wobble
    // without darkening or brightening the mask underneath it.
    const edge = grain.sub(0.5).mul(u.edgeStrength).add(1).toVar()
    // crossing two grids halves the texture contrast, so the tonal swing is
    // wider than a flat-colour layer would need it
    const swing = mix(0.75, 1.25, tone).toVar()

    // bare ground: the base layer, so it shows wherever nothing else is painted.
    // toVar() once, here: every layer below writes through assign()
    const surface = (groundMap
      ? tiledColor(groundMap, u.groundTile, u.groundWarp, u.warpFreq).mul(swing).mul(u.groundTint)
      : mix(u.groundDark, u.groundLight, tone)).toVar()

    // grass, then road on top: a path is cut THROUGH a field, so painted road
    // has to win over painted grass, not the other way round
    const grass = grassMap
      ? tiledColor(grassMap, u.grassTile, u.grassWarp, u.warpFreq).mul(swing).mul(u.grassTint)
      : mix(u.grassDark, u.grassLight, tone)
    surface.assign(mix(surface, grass, smoothstep(u.grassBlendLow, u.grassBlendHigh, data.g.mul(edge))))

    const gravel = roadMap
      ? tiledColor(roadMap, u.roadTile, u.roadWarp, u.warpFreq).mul(swing).mul(u.roadTint)
      // grain, not tone: gravel's gradient runs per stone, not per patch
      : mix(u.roadDark, u.roadLight, grain)
    surface.assign(mix(surface, gravel, smoothstep(u.roadBlendLow, u.roadBlendHigh, data.r.mul(edge))))

    // rock is a slope override, not a paint layer, so it goes last: steep faces
    // are bare stone no matter what the map says is growing there
    const rock = rockMap
      ? tiledColor(rockMap, u.rockTile, u.rockWarp, u.warpFreq).mul(swing).mul(u.rockTint)
      // rock's own finer noise, not the shared tone field: stone reads at a
      // smaller scale than soil
      : mix(u.rockDark, u.rockLight, worldNoise(u.rockFreq))
    const steep = smoothstep(u.slopeStart, u.slopeEnd, normalWorld.y).oneMinus()
    surface.assign(mix(surface, rock, steep))

    // shore darkening applies to whatever material ended up there
    const wet = smoothstep(u.shoreLow, u.shoreHigh, data.b)
    surface.assign(mix(surface, u.wetGround, wet))
    return surface
  })()

  material.colorNode = surfaceColor

  if (grading) {
    // hills are the only thing giving this scene form, so keep core shadows AND
    // the mid tone: two tones alone read flat on a smooth heightfield
    const dropShadow = createDropShadowCatcher()
    material.receivedShadowNode = dropShadow.receivedShadowNode
    material.outputNode = stylizedOutput(surfaceColor, grading, {
      hasMidTone: true,
      dropShadowNode: dropShadow.shadowFactor,
    })
  }

  return { material, uniforms: u }
}
