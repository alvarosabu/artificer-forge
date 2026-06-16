import { describe, expect, it } from 'vitest'
import { createSurfaceGrid } from './grid'
import { packState } from './texture'

describe('packState', () => {
  it('packs electrified into R and frozen into G', () => {
    const grid = createSurfaceGrid(4, 4, 1)
    grid.stampDisc(1, 1, 'water', 0, 1, Number.POSITIVE_INFINITY)
    const cell = grid.cellAt(1, 1)!
    cell.electrified = 0.5
    cell.frozen = true

    const data = new Float32Array(4 * 4 * 4)
    packState(grid.cells, data)

    const o = grid.index(1, 1) * 4
    expect(data[o]).toBe(0.5) // R = electrified
    expect(data[o + 1]).toBe(1) // G = frozen
    expect(data[o + 2]).toBe(0)
    expect(data[o + 3]).toBe(0)
  })
})
