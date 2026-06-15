import { AdditiveBlending } from 'three'
import { MeshStandardNodeMaterial } from 'three/webgpu'
import {
  add, clamp, color, float, mix, mul, mx_fractal_noise_float,
  positionWorld, pow, sin, smoothstep, texture as textureNode, time, uv, vec2,
} from 'three/tsl'
import type { DataTexture } from 'three'

/**
 * TSL material for a fire surface plane.
 * Accepts a fire DataTexture (R = cell amount, packed by packFire).
 *
 * Two-pass approach (mirrors buildBurningEmissiveNode):
 * Pass 1 — low-freq warp noise displaces XZ so flames sway laterally (tongue shapes)
 * Pass 2 — high-freq FBM gives the flame body
 * Both noise passes are anchored to world position (no time scroll), so the
 * flame breathes in place; a pulse term modulates intensity rather than the
 * field drifting in one direction.
 * All noise remapped from ~[-1,1] → [0,1] before use.
 */
export function buildFireSurfaceMaterial(fireTex: DataTexture): MeshStandardNodeMaterial {
  const mat = new MeshStandardNodeMaterial()
  mat.transparent = true
  mat.depthWrite = false
  mat.blending = AdditiveBlending

  // Fire coverage from texture — R channel, V flip matches grid orientation
  const fieldUv = vec2(uv().x, uv().y.oneMinus())
  const fireAmount = textureNode(fireTex, fieldUv).r

  // Pass 1 — lateral warp: anchored to world position (no drift)
  const warpPos = mul(positionWorld.xz, float(1.5))
  const warpNoise = mx_fractal_noise_float(warpPos, 2, 2.0, 0.5)
    .mul(float(0.5)).add(float(0.5)) // remap ~[-1,1] → [0,1]
  const warp = warpNoise.sub(float(0.5)).mul(float(0.45)) // center around 0

  // Pass 2 — main flame body: anchored to world position, warp gives tongue shape
  const flamePos = add(
    mul(positionWorld.xz, float(3.5)),
    vec2(warp, float(0)),
  )
  const rawFlame = mx_fractal_noise_float(flamePos, 4, 2.0, 0.5)
  // Remap — critical: without this flameDensity is ~[-1,1] and smoothstep gives ~0 everywhere
  const flame = clamp(rawFlame.mul(float(0.5)).add(float(0.5)), float(0), float(1))

  // Tongues taper as they rise (uv.y = 0 at near edge, 1 at far)
  const heightFade = pow(uv().y.oneMinus(), float(1.2))

  // Pulse — two out-of-phase sines breathe the whole field in place. Kept in
  // [0.65,1] so the flame dims and brightens but never fully dies. This (not a
  // scrolling offset) is what animates the static flame.
  const pulse = add(
    sin(time.mul(float(2.2))).mul(float(0.5)).add(float(0.5)).mul(float(0.7)),
    sin(time.mul(float(3.7)).add(float(1.3))).mul(float(0.5)).add(float(0.5)).mul(float(0.3)),
  ).mul(float(0.35)).add(float(0.65))

  // Final mask: flame shape × height × surface coverage × pulse
  const flameMask = flame.mul(heightFade).mul(fireAmount).mul(pulse)
  const fireMask = smoothstep(float(0.2), float(0.65), flameMask)

  // 4-stop heat ramp driven by flame density: ember-red → orange → yellow → white core
  const heat = flame
  const fireCol = mix(
    mix(color('#bb1100'), color('#ff4400'), smoothstep(float(0.0), float(0.45), heat)),
    mix(color('#ffaa00'), color('#fffce0'), smoothstep(float(0.65), float(1.0), heat)),
    smoothstep(float(0.4), float(0.65), heat),
  )

  // Emissive — stronger at the base, fades toward tips
  const emissiveIntensity = mix(float(3.5), float(1.2), uv().y)

  mat.colorNode = fireCol
  mat.emissiveNode = mul(fireCol, mul(fireMask, emissiveIntensity))
  mat.opacityNode = fireMask

  return mat
}
