import { describe, expect, it } from 'vitest'
import { worldToPixel } from './trample'

describe('worldToPixel', () => {
  it('maps the origin to the canvas center', () => {
    const p = worldToPixel(0, 0, 0, 0, 30, 256)
    expect(p.x).toBe(128)
    expect(p.y).toBe(128)
  })

  it('maps +x to increasing pixel x', () => {
    const p = worldToPixel(15, 0, 0, 0, 30, 256)
    expect(p.x).toBe(256)
  })

  it('maps +z to decreasing pixel y (CanvasTexture flipY)', () => {
    const p = worldToPixel(0, 15, 0, 0, 30, 256)
    expect(p.y).toBe(0)
  })

  it('shifts with the origin', () => {
    const p = worldToPixel(10, 10, 10, 10, 30, 256)
    expect(p.x).toBe(128)
    expect(p.y).toBe(128)
  })
})
