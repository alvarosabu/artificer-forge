import { describe, expect, it } from 'vitest'
import { createSurfaceGrid } from './grid'
import { hasFireNear } from './matrix'

// 10x10 grid, 1m cells, centred on origin.
function fireGrid() {
  const grid = createSurfaceGrid(10, 10, 1)
  // Stamp a single fire cell at the centre (col 5, row 5).
  grid.stampDisc(5, 5, 'fire', 0, 1, 6)
  return grid
}

describe('hasFireNear', () => {
  it('is false on the fire cell itself (centre excluded)', () => {
    const grid = fireGrid()
    expect(hasFireNear(grid.cellAt, 5, 5, 2)).toBe(false)
  })

  it('is true for a directly adjacent cell', () => {
    const grid = fireGrid()
    expect(hasFireNear(grid.cellAt, 6, 5, 2)).toBe(true)
    expect(hasFireNear(grid.cellAt, 5, 7, 2)).toBe(true)
  })

  it('is false beyond the radius', () => {
    const grid = fireGrid()
    // 3 cells away on the axis — outside radius 2.
    expect(hasFireNear(grid.cellAt, 8, 5, 2)).toBe(false)
  })

  it('respects the disc test (corner outside r)', () => {
    const grid = fireGrid()
    // (2,2) offset → dist² = 8 > 2²=4, so excluded even though within the box.
    expect(hasFireNear(grid.cellAt, 7, 7, 2)).toBe(false)
  })

  it('ignores non-fire kinds', () => {
    const grid = createSurfaceGrid(10, 10, 1)
    grid.stampDisc(5, 5, 'water', 0, 1, 20)
    expect(hasFireNear(grid.cellAt, 6, 5, 2)).toBe(false)
  })
})
