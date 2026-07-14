import { describe, expect, it } from 'vitest'
import { Color } from 'three'
import { createWindLineGeometry, createWindLines, remapClamp, windLineHandles } from './windLines'

describe('remapClamp', () => {
  it('maps midpoint linearly', () => {
    expect(remapClamp(0.5, 0, 1, 8, 2)).toBe(5)
  })
  it('clamps below input range', () => {
    expect(remapClamp(-1, 0, 1, 8, 2)).toBe(8)
  })
  it('clamps above input range', () => {
    expect(remapClamp(2, 0, 1, 8, 2)).toBe(2)
  })
})

describe('windLineHandles', () => {
  it('alternates y by ±amplitude/2 and spans z from -length/2 to +length/2', () => {
    const handles = windLineHandles(10, 4, 2)
    expect(handles).toHaveLength(4)
    expect(handles.map(h => h.y)).toEqual([-1, 1, -1, 1])
    expect(handles[0].z).toBe(-5)
    expect(handles[3].z).toBe(5)
    expect(handles.every(h => h.x === 0)).toBe(true)
  })
})

describe('createWindLineGeometry', () => {
  it('duplicates every curve point with matching ratio and builds 2 triangles per segment', () => {
    const geometry = createWindLineGeometry({ divisions: 30 })
    const pointCount = 31 // divisions + 1
    const position = geometry.getAttribute('position')
    const ratio = geometry.getAttribute('ratio')
    expect(position.count).toBe(pointCount * 2)
    expect(ratio.count).toBe(pointCount * 2)
    // pairs share the same position
    expect(position.getX(0)).toBe(position.getX(1))
    expect(position.getY(0)).toBe(position.getY(1))
    expect(position.getZ(0)).toBe(position.getZ(1))
    // ratio runs 0 → 1, duplicated
    expect(ratio.getX(0)).toBe(0)
    expect(ratio.getX(1)).toBe(0)
    expect(ratio.getX(pointCount * 2 - 1)).toBe(1)
    // (pointCount - 1) segments × 2 triangles × 3 indices
    expect(geometry.getIndex()!.count).toBe((pointCount - 1) * 6)
  })
})

describe('createWindLines', () => {
  it('builds a hidden pool sharing one geometry, one material per line', () => {
    const { lines, uniforms, dispose } = createWindLines({ count: 3, color: '#ffffff', thickness: 0.1 })
    expect(lines).toHaveLength(3)
    expect(lines.every(l => !l.active && !l.mesh.visible)).toBe(true)
    expect(lines.every(l => l.mesh.geometry === lines[0].mesh.geometry)).toBe(true)
    expect(lines[0].mesh.material).not.toBe(lines[1].mesh.material)
    expect(lines.every(l => l.progress.value === 0)).toBe(true)
    expect(lines.every(l => l.mesh.renderOrder === 1)).toBe(true)
    expect(uniforms.color.value).toEqual(new Color('#ffffff'))
    expect(uniforms.thickness.value).toBe(0.1)
    dispose()
  })
})
