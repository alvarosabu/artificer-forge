import { describe, expect, it } from 'vitest'
import { frameFromHead, type Vec3 } from './portraitRigPresets'

describe('frameFromHead', () => {
  // A Rig_Medium head mesh box: centre ~1.76, ~1.0 tall, on the X/Z centre line.
  const center: Vec3 = [0, 1.76, 0]
  const headHeight = 1.0

  it('anchors the look on the head-box centre by default', () => {
    const f = frameFromHead(center, headHeight)
    expect(f.lookAt[1]).toBeCloseTo(center[1])
  })

  it('shifts the look up/down with headLift', () => {
    expect(frameFromHead(center, headHeight, { headLift: 0.25 }).lookAt[1])
      .toBeGreaterThan(center[1])
    expect(frameFromHead(center, headHeight, { headLift: -0.25 }).lookAt[1])
      .toBeLessThan(center[1])
  })

  it('places the camera in front of the head (+Z) and level with the look', () => {
    // Neutralise the aesthetic knobs so this checks only the front-placement /
    // level-camera invariants, not the tuned yaw/height defaults.
    const f = frameFromHead(center, headHeight, { yaw: 0, cameraHeightOffset: 0 })
    expect(f.cameraPosition[2]).toBeGreaterThan(center[2])
    expect(f.cameraPosition[1]).toBeCloseTo(f.lookAt[1])
  })

  it('centres horizontally on the head box', () => {
    // yaw orbits the camera off-centre by design, so pin it to a dead-front view.
    const f = frameFromHead([2, 1.76, 0], headHeight, { yaw: 0 })
    expect(f.cameraPosition[0]).toBeCloseTo(2)
    expect(f.lookAt[0]).toBeCloseTo(2)
  })

  it('is identical for same-rig characters (depends only on head box)', () => {
    // Characters sharing a rig resolve to the same head box, so framing must match
    // exactly — cloaks/weapons/body shape never enter the math.
    expect(frameFromHead(center, headHeight)).toEqual(frameFromHead(center, headHeight))
  })

  it('scales the framing distance to head size, not body/leg height', () => {
    // A larger HEAD (not a taller rig) moves the camera back proportionally. Both
    // heads sit on the Z centre line, so cameraPosition[2] is the framing distance.
    const small = frameFromHead([0, 1.76, 0], 1.0, { yaw: 0 })
    const big = frameFromHead([0, 3.9, 0], 1.5, { yaw: 0 })
    expect(big.cameraPosition[2]).toBeGreaterThan(small.cameraPosition[2])
    // ...but only ~1.5x (head-size ratio), not the ~2.6x a head-bone-height
    // scale would have given (the bug that zoomed the werewolf out).
    expect(big.cameraPosition[2] / small.cameraPosition[2]).toBeCloseTo(1.5)
  })

  it('passes the fov through', () => {
    expect(frameFromHead(center, headHeight, { fov: 42 }).fov).toBe(42)
  })

  it('respects framing overrides', () => {
    const tighter = frameFromHead(center, headHeight, { viewHeight: 0.8, yaw: 0 })
    const wider = frameFromHead(center, headHeight, { viewHeight: 2.0, yaw: 0 })
    // A smaller view height means a closer camera (tighter crop).
    expect(tighter.cameraPosition[2]).toBeLessThan(wider.cameraPosition[2])
  })
})
