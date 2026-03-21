import { abs, clamp, color, cos, float, mix, mx_fractal_noise_float, mx_worley_noise_float, positionLocal, pow, sin, smoothstep, time, vec3 } from 'three/tsl'

export type StatusOverlayEffectId = 'poisoned' | 'burning' | 'frozen'

export interface StatusOverlayEffectConfig {
  color: string
  flowSpeed: number
  scale: number
  sharpness: number
  pulseSpeed: number
  intensity: number
}

export const STATUS_OVERLAY_EFFECTS: Record<StatusOverlayEffectId, StatusOverlayEffectConfig> = {
  poisoned: { color: '#22ff44', flowSpeed: 0.3, scale: 3.0, sharpness: 3.0, pulseSpeed: 1.5, intensity: 0.8 },
  frozen: { color: '#aaddff', flowSpeed: 0.0, scale: 3.0, sharpness: 4.0, pulseSpeed: 0.4, intensity: 1.0 },
  burning: { color: '#ff5500', flowSpeed: 1.2, scale: 4.0, sharpness: 2.5, pulseSpeed: 4.0, intensity: 1.2 },
}

/** Worley-based flowing overlay — used for poisoned */
export function buildWorleyEmissiveNode(cfg: StatusOverlayEffectConfig) {
  const animPos = positionLocal.mul(cfg.scale).add(vec3(0, time.mul(cfg.flowSpeed), 0))
  const cells = mx_worley_noise_float(animPos, 0.9)
  const mask = pow(float(1).sub(cells), cfg.sharpness)
    .mul(sin(time.mul(cfg.pulseSpeed)).mul(0.5).add(0.5))
  return color(cfg.color).mul(mask).mul(cfg.intensity)
}

/**
 * FBM flame overlay — used for burning.
 * Two-pass approach: a low-freq warp pass makes flames sway laterally,
 * then a high-freq FBM pass shapes the flame body.
 * A 3-stop color ramp (dark red → orange → yellow) maps heat intensity.
 * Two overlapping sines create an organic flicker beat.
 */
export function buildBurningEmissiveNode(cfg: StatusOverlayEffectConfig) {
  // Pass 1 — lateral warp: low-freq FBM displaces X/Z so flames sway
  const warpPos = positionLocal.mul(float(cfg.scale * 0.35)).add(vec3(0, time.mul(0.25), 0))
  const warpNoise = mx_fractal_noise_float(warpPos, 2, 2.0, 0.5)
  const warp = warpNoise.mul(float(0.3))

  // Pass 2 — main flame body: fast upward flow + lateral warp applied
  const animPos = positionLocal.mul(cfg.scale)
    .add(vec3(warp, time.mul(-cfg.flowSpeed), warp))
  const rawNoise = mx_fractal_noise_float(animPos, 4, 2.0, 0.5)
  // Remap FBM output (~[-1,1]) to [0,1] and clamp
  const flame = clamp(rawNoise.mul(0.5).add(0.5), float(0), float(1))
  const shaped = pow(flame, float(cfg.sharpness))

  // 3-stop heat ramp: ember red → flame orange → white-yellow tips
  const red = color('#bb1100')
  const orange = color('#ff5500')
  const yellow = color('#ffee44')
  const heat = mix(red, orange, shaped)
  const heatColor = mix(heat, yellow, pow(shaped, float(2.5)))

  // Double-frequency flicker: two offset sines → organic beat, not metronome
  const f1 = sin(time.mul(cfg.pulseSpeed)).mul(0.12).add(0.88)
  const f2 = sin(time.mul(cfg.pulseSpeed * 2.7 + 1.3)).mul(0.06).add(0.94)

  // Height mask: flames fade at feet (y=0), full intensity from knees up (y≈0.7)
  const heightMask = smoothstep(float(0.0), float(0.7), positionLocal.y)

  return heatColor.mul(shaped).mul(f1).mul(f2).mul(cfg.intensity).mul(heightMask)
}

/**
 * Hex crystal lattice overlay — used for frozen.
 * Three cosine waves at ~60° apart produce a hexagonal facet pattern
 * that mimics ice crystal growth (similar to BG3's frozen effect).
 * Crystal edges glow bright white; facet interiors are deep blue.
 */
export function buildFrozenEmissiveNode(cfg: StatusOverlayEffectConfig) {
  const p = positionLocal.mul(cfg.scale)
  const sqrt3 = float(1.732)
  const c1 = cos(p.x.mul(2.0).add(p.y.mul(sqrt3)))
  const c2 = cos(p.y.mul(2.0).add(p.z.mul(sqrt3)))
  const c3 = cos(p.z.mul(2.0).add(p.x.mul(sqrt3)))
  // lattice in [-1, 1]; abs+pow sharpens to crystal-edge ridges
  const lattice = c1.add(c2).add(c3).mul(float(1.0 / 3.0))
  const edge = pow(abs(lattice), float(cfg.sharpness))
  const pulse = sin(time.mul(cfg.pulseSpeed)).mul(0.15).add(0.85)
  const iceCore = color('#1144aa')
  const iceTip = color(cfg.color)

  // Height mask: frost spreads upward from ground — full at feet, fades above mid-torso
  const heightMask = float(1.0).sub(smoothstep(float(0.8), float(2.0), positionLocal.y))

  return mix(iceCore, iceTip, edge).mul(pulse).mul(cfg.intensity).mul(heightMask)
}

export const STATUS_OVERLAY_BUILDERS: Record<StatusOverlayEffectId, (cfg: StatusOverlayEffectConfig) => ReturnType<typeof buildWorleyEmissiveNode>> = {
  poisoned: buildWorleyEmissiveNode,
  burning: buildBurningEmissiveNode,
  frozen: buildFrozenEmissiveNode,
}
