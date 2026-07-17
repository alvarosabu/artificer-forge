import { Color, Vector3 } from 'three'

type PresetValue = Color | Vector3 | number
export type Preset = Record<string, PresetValue>
/** constraint that also accepts interfaces like GradingProps (no index signature required, unlike Preset) */
type PresetLike<T> = { [K in keyof T]: PresetValue }

export function wrap01(v: number) {
  return ((v % 1) + 1) % 1
}

function clonePreset<T extends PresetLike<T>>(a: T): T {
  const out = {} as Record<string, PresetValue>
  for (const [key, v] of Object.entries<PresetValue>(a)) {
    out[key] = typeof v === 'number' ? v : v.clone()
  }
  return out as T
}

export function lerpPresets<T extends PresetLike<T>>(a: T, b: T, t: number, target: T = clonePreset(a)): T {
  const br = b as Record<string, PresetValue>
  const out = target as Record<string, PresetValue>
  for (const [key, va] of Object.entries<PresetValue>(a)) {
    const vb = br[key]!
    if (typeof va === 'number') out[key] = va + ((vb as number) - va) * t
    else if (va instanceof Color) (out[key] as Color).lerpColors(va, vb as Color, t)
    else (out[key] as Vector3).lerpVectors(va, vb as Vector3, t)
  }
  return target
}

/**
 * Interpolates presets along a 0-1 loop. Knows nothing about day or night:
 * a weather system or a dungeon mood track uses the exact same primitive.
 */
export function createPresetTrack<T extends PresetLike<T>>(presets: T[], stops: number[]) {
  if (presets.length === 0 || presets.length !== stops.length)
    throw new Error('presets/stops must be same non-zero length')
  for (let i = 1; i < stops.length; i++) {
    if (stops[i]! <= stops[i - 1]!) throw new Error('stops must be strictly ascending')
  }
  if (stops[0]! < 0 || stops[stops.length - 1]! >= 1) throw new Error('stops must be within [0, 1)')

  function sample(phase: number, target?: T): T {
    const p = wrap01(phase)
    // segment start: last stop <= p, else the last segment wraps around
    let i = stops.length - 1
    for (let s = 0; s < stops.length; s++) {
      if (stops[s]! <= p) i = s
    }
    const j = (i + 1) % stops.length
    const span = wrap01(stops[j]! - stops[i]!) || 1 // single-preset track → span 1
    const t = wrap01(p - stops[i]!) / span
    return lerpPresets(presets[i]!, presets[j]!, t, target)
  }

  return { sample }
}

/** Tweens a phase toward a target going the SHORT way around the 0-1 loop. */
export function createPhaseTween() {
  let from = 0
  let to = 0
  let duration = 0
  let elapsed = 0
  let active = false

  return {
    get active() { return active },
    start(fromPhase: number, toPhase: number, dur: number) {
      from = wrap01(fromPhase)
      let delta = wrap01(toPhase - from) // forward distance, 0..1
      if (delta > 0.5) delta -= 1 // backward is shorter
      to = from + delta // may exceed [0,1]; wrapped on output
      duration = dur
      elapsed = 0
      active = duration > 0 && delta !== 0
    },
    /** returns the current phase while tweening, null when idle */
    tick(delta: number): number | null {
      if (!active) return null
      elapsed += delta
      const t = Math.min(elapsed / duration, 1)
      if (t >= 1) active = false
      return wrap01(from + (to - from) * t)
    },
  }
}
