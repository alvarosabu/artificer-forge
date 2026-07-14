import { describe, expect, it } from 'vitest'
import { Color, Euler, Vector3 } from 'three'
import { createWindLineGeometry, createWindLines, remapClamp, spawnWindLine, updateWindLines, windLineHandles, type WindLineInstance } from './windLines'

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

function fakeLine(): WindLineInstance {
  return {
    mesh: { position: new Vector3(), rotation: new Euler(), visible: false } as any,
    progress: { value: 0 } as any,
    elapsed: 0,
    duration: 0,
    startX: 0,
    startZ: 0,
    angle: 0,
    active: false,
  }
}

const ctx = { originX: 0, originZ: 0, radius: 10, height: 2, windAngle: Math.PI / 2, intensity: 0.5 }

describe('spawnWindLine', () => {
  it('activates the first available line with duration from intensity', () => {
    const lines = [fakeLine(), fakeLine()]
    expect(spawnWindLine(lines, ctx, () => 0.5)).toBe(true)
    expect(lines[0].active).toBe(true)
    expect(lines[0].mesh.visible).toBe(true)
    expect(lines[0].duration).toBe(5) // remapClamp(0.5, 0, 1, 8, 2)
    expect(lines[0].mesh.position.y).toBe(2)
    expect(lines[0].mesh.rotation.y).toBe(Math.PI / 2)
    expect(lines[0].progress.value).toBe(0)
    expect(lines[1].active).toBe(false)
  })

  it('scatters within ±radius of origin', () => {
    const lines = [fakeLine()]
    spawnWindLine(lines, ctx, () => 1) // rng pinned to max
    expect(lines[0].startX).toBe(10)
    expect(lines[0].startZ).toBe(10)
  })

  it('drops the spawn when the pool is exhausted', () => {
    const lines = [fakeLine()]
    lines[0].active = true
    expect(spawnWindLine(lines, ctx, () => 0.5)).toBe(false)
  })
})

describe('updateWindLines', () => {
  it('advances progress, drifts along wind, and frees the line on completion', () => {
    const lines = [fakeLine()]
    spawnWindLine(lines, { ...ctx, windAngle: 0 }, () => 0.5) // duration 5, facing +Z
    updateWindLines(lines, 2.5, 1)
    expect(lines[0].progress.value).toBeCloseTo(0.5)
    expect(lines[0].mesh.position.z).toBeCloseTo(lines[0].startZ + 0.5) // cos(0) * translation * t
    updateWindLines(lines, 2.5, 1)
    expect(lines[0].progress.value).toBe(1)
    expect(lines[0].active).toBe(false)
    expect(lines[0].mesh.visible).toBe(false)
  })

  it('ignores inactive lines', () => {
    const lines = [fakeLine()]
    updateWindLines(lines, 1, 1)
    expect(lines[0].progress.value).toBe(0)
  })
})
