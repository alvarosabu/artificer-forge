import { Color } from 'three'
import { describe, expect, it } from 'vitest'
import { createPhaseTween, createPresetTrack } from './presetTrack'

const presets = [
  { tint: new Color(1, 0, 0), value: 0 }, // stop 0
  { tint: new Color(0, 1, 0), value: 10 }, // stop 0.25
  { tint: new Color(0, 0, 1), value: 20 }, // stop 0.5
  { tint: new Color(1, 1, 1), value: 30 }, // stop 0.75
]
const stops = [0, 0.25, 0.5, 0.75]

describe('createPresetTrack', () => {
  it('returns the preset exactly on a stop', () => {
    const track = createPresetTrack(presets, stops)
    const out = track.sample(0.25)
    expect(out.value).toBe(10)
    expect(out.tint.getHex()).toBe(0x00FF00)
  })

  it('lerps 50/50 at a segment midpoint', () => {
    const track = createPresetTrack(presets, stops)
    const out = track.sample(0.125)
    expect(out.value).toBeCloseTo(5)
    expect(out.tint.r).toBeCloseTo(0.5)
    expect(out.tint.g).toBeCloseTo(0.5)
  })

  it('wraps the last segment back to the first preset', () => {
    const track = createPresetTrack(presets, stops)
    // phase 0.875 = midpoint of segment 0.75 → 1.0(=0)
    const out = track.sample(0.875)
    expect(out.value).toBeCloseTo(15) // between 30 and 0
  })

  it('returns a single-preset track verbatim at any phase', () => {
    const track = createPresetTrack([presets[0]], [0])
    expect(track.sample(0.7).value).toBe(0)
  })

  it('writes into the provided target without allocating', () => {
    const track = createPresetTrack(presets, stops)
    const target = { tint: new Color(), value: 0 }
    const out = track.sample(0.25, target)
    expect(out).toBe(target)
  })

  it('rejects unsorted stops', () => {
    expect(() => createPresetTrack(presets, [0, 0.5, 0.25, 0.75])).toThrow()
  })
})

describe('createPhaseTween', () => {
  it('goes forward through 1.0 when that is shorter (0.9 → 0.1)', () => {
    const tween = createPhaseTween()
    tween.start(0.9, 0.1, 1)
    expect(tween.tick(0.5)).toBeCloseTo(0.0) // halfway: 0.9 + 0.2*0.5 = 1.0 → wraps
    expect(tween.tick(0.5)).toBeCloseTo(0.1)
    expect(tween.active).toBe(false)
  })

  it('goes backward when that is shorter (0.1 → 0.9)', () => {
    const tween = createPhaseTween()
    tween.start(0.1, 0.9, 1)
    expect(tween.tick(0.5)).toBeCloseTo(0.0) // 0.1 - 0.2*0.5
  })

  it('is idle before start and after completion', () => {
    const tween = createPhaseTween()
    expect(tween.tick(1)).toBeNull()
  })
})
