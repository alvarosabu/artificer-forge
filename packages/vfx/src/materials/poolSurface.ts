import { MeshStandardNodeMaterial } from 'three/webgpu'
import {
  add, color, cos, dot, float, max, mix, mul, mx_fractal_noise_float, normalView,
  positionViewDirection, positionWorld, smoothstep, texture as textureNode, time, uv, vec2, vec3,
} from 'three/tsl'
import type { DataTexture } from 'three'

/**
 * TSL material for the liquid-pool surface overlay (water/oil/poison/blood).
 * Accepts a DataTexture whose channels are packed by packCells:
 *   R = water, G = oil, B = poison, A = blood (0..1 coverage).
 *
 * Fire/charcoal are NOT handled here — they need vertical relief and live on
 * their own displaced meshes (buildCharcoalSurfaceMaterial / buildFireSurfaceMaterial).
 */
export function buildPoolSurfaceMaterial(tex: DataTexture): MeshStandardNodeMaterial {
  const mat = new MeshStandardNodeMaterial()
  mat.transparent = true
  mat.depthWrite = false // transparent overlay — writing depth here occludes the fire billboards when draw order flips on orbit
  mat.roughness = 0.9

  const fieldUv = vec2(uv().x, uv().y.oneMinus()) // keep the spike's V flip — it's load-bearing
  const amount = textureNode(tex, fieldUv)
  const water = amount.r
  const oil = amount.g
  const poison = amount.b
  const blood = amount.a

  // Slow-drifting noise breaks pool edges so they read organic, not disc-shaped.
  const edgeNoise = mx_fractal_noise_float(
    add(mul(positionWorld.xz, 1.8), time.mul(0.05)),
    3, 2.0, 0.5,
  ).mul(0.5).add(0.5)

  const maskOf = (amount: ReturnType<typeof float>) =>
    smoothstep(float(0.15), float(0.6), amount.mul(edgeNoise.mul(0.6).add(0.7)))

  const waterMask = maskOf(water)
  const oilMask = maskOf(oil)
  const poisonMask = maskOf(poison)
  const bloodMask = maskOf(blood)

  const waterCol = mix(color('#0c3b66'), color('#2f7fd0'), edgeNoise)

  // Fake thin-film iridescence: a cosine rainbow palette phased by view angle
  // + the shared noise. Real iridescence is specular-driven and needs env
  // reflections — under flat ambient light this cheat reads better.
  const facing = dot(normalView, positionViewDirection).saturate()
  const filmPhase = edgeNoise.mul(2.5).add(facing.mul(1.5)).add(time.mul(0.06))
  const rainbow = vec3(
    cos(filmPhase.mul(Math.PI * 2)),
    cos(filmPhase.mul(Math.PI * 2).sub(2.094)), // ±120° per channel = hue wheel
    cos(filmPhase.mul(Math.PI * 2).sub(4.188)),
  ).mul(0.5).add(0.5)
  const sheen = smoothstep(float(0.35), float(0.8), edgeNoise).mul(0.55) // patchy, like a real slick
  const oilCol = mix(mix(color('#14100c'), color('#3a2f1c'), edgeNoise), rainbow, sheen)
  const poisonCol = mix(color('#176022'), color('#37d24a'), edgeNoise)
  const bloodCol = mix(color('#3d060a'), color('#6e0f14'), edgeNoise)

  // Only one kind occupies a cell — overlap only exists in the bilinear blend
  // zone between pools, where later layers win.
  const base = color('#0e1118')
  let col = mix(base, waterCol, waterMask)
  col = mix(col, oilCol, oilMask)
  col = mix(col, poisonCol, poisonMask)
  col = mix(col, bloodCol, bloodMask)

  // Per-kind opacity — kinds are exclusive per cell, so max() picks whichever
  // is active (seams briefly blend both, which reads fine).
  const opacity = max(
    waterMask.mul(0.15), // water: see the ground through it
    max(oilMask.mul(0.95), max(poisonMask.mul(0.85), bloodMask.mul(0.9))),
  )

  mat.colorNode = col
  mat.opacityNode = opacity
  return mat
}
