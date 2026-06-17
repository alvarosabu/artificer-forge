import { describe, expect, it } from 'vitest'
import { entitiesInCircle, entitiesInCone, entitiesInLine } from './aoe'

function map(entries: Record<string, { x: number, z: number }>) {
  return new Map(Object.entries(entries).map(([id, position]) => [id, { position }]))
}

describe('entitiesInCircle', () => {
  it('includes ids within the radius and excludes those outside', () => {
    const e = map({ a: { x: 1, z: 0 }, b: { x: 3, z: 4 }, c: { x: 0, z: 2 } })
    expect(entitiesInCircle({ x: 0, z: 0 }, 2.5, e).sort()).toEqual(['a', 'c'])
  })
})

describe('entitiesInCone', () => {
  it('includes only ids inside the half-angle and range', () => {
    const e = map({
      front: { x: 0, z: 5 }, // straight ahead
      side: { x: 5, z: 0 }, // 90° off axis
      far: { x: 0, z: 20 }, // ahead but out of range
    })
    const ids = entitiesInCone({ x: 0, z: 0 }, { x: 0, z: 1 }, 10, 45, e)
    expect(ids).toEqual(['front'])
  })
})

describe('entitiesInLine', () => {
  it('includes ids within the band along the segment', () => {
    const e = map({
      on: { x: 0.2, z: 5 }, // near the line
      off: { x: 3, z: 5 }, // too far perpendicular
      behind: { x: 0, z: -1 }, // before the start
    })
    const ids = entitiesInLine({ x: 0, z: 0 }, { x: 0, z: 10 }, 1, e)
    expect(ids).toEqual(['on'])
  })
})
