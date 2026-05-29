import { describe, expect, it } from 'vitest'
import { frameFromBounds, framingForRig, PORTRAIT_FRAMING } from '../utils/portraitRigPresets'

describe('framingForRig', () => {
  it('returns the Medium preset for Rig_Medium', () => {
    expect(framingForRig('Rig_Medium')).toBe(PORTRAIT_FRAMING.Medium)
  })

  it('returns the Large preset for Rig_Large', () => {
    expect(framingForRig('Rig_Large')).toBe(PORTRAIT_FRAMING.Large)
  })

  it('falls back to Medium for unknown or missing rig', () => {
    expect(framingForRig(undefined)).toBe(PORTRAIT_FRAMING.Medium)
    expect(framingForRig('Rig_Tiny')).toBe(PORTRAIT_FRAMING.Medium)
  })
})

describe('frameFromBounds', () => {
  // A 4-unit-tall model standing at the origin (feet ~0, head ~4).
  const min: [number, number, number] = [-1, 0, -1]
  const max: [number, number, number] = [1, 4, 1]

  it('anchors the look between the vertical centre and the top (head region)', () => {
    const f = frameFromBounds(min, max)
    const centerY = (min[1] + max[1]) / 2 // 2
    expect(f.lookAt[1]).toBeGreaterThan(centerY)
    expect(f.lookAt[1]).toBeLessThan(max[1])
  })

  it('places the camera in front of the model (beyond max Z) and level with the look', () => {
    const f = frameFromBounds(min, max)
    expect(f.cameraPosition[2]).toBeGreaterThan(max[2])
    expect(f.cameraPosition[1]).toBeCloseTo(f.lookAt[1])
  })

  it('centres horizontally on the box centre', () => {
    const f = frameFromBounds([-2, 0, -1], [4, 4, 1])
    expect(f.cameraPosition[0]).toBeCloseTo(1) // (-2 + 4) / 2
    expect(f.lookAt[0]).toBeCloseTo(1)
  })

  it('moves the camera further back for a taller model', () => {
    const small = frameFromBounds([-1, 0, -1], [1, 2, 1])
    const tall = frameFromBounds([-1, 0, -1], [1, 8, 1])
    const smallDist = small.cameraPosition[2] - 1
    const tallDist = tall.cameraPosition[2] - 1
    expect(tallDist).toBeGreaterThan(smallDist)
  })

  it('passes the fov through', () => {
    expect(frameFromBounds(min, max, { fov: 42 }).fov).toBe(42)
  })

  it('respects framing overrides', () => {
    const tighter = frameFromBounds(min, max, { viewHeightFraction: 0.2 })
    const wider = frameFromBounds(min, max, { viewHeightFraction: 0.8 })
    // A smaller view fraction means a closer camera (tighter crop).
    expect(tighter.cameraPosition[2]).toBeLessThan(wider.cameraPosition[2])
  })
})
