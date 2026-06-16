import { describe, expect, it } from 'vitest'
import { createSurfaceGrid } from './grid'
import { step } from './sim'
import type { SurfaceKind } from './types'

// 20x20 grid, 1m cells, centred on origin → world (0,0) is cell (10,10).
function grownPool(kind: SurfaceKind) {
  const grid = createSurfaceGrid(20, 20, 1)
  grid.seed(0, 0, kind)
  // Run long enough for the spreading source to finish and hand out lifetimes.
  for (let i = 0; i < 50; i++) step(grid, 0.1)
  return grid
}

describe('surface decay', () => {
  it('water pools never decay', () => {
    const grid = grownPool('water')
    const centre = grid.cellAt(10, 10)!
    for (let i = 0; i < 400; i++) step(grid, 0.1) // ~40s
    expect(centre.kind).toBe('water')
    expect(centre.amount).toBe(1)
  })

  it('blood pools never decay', () => {
    const grid = grownPool('blood')
    const centre = grid.cellAt(10, 10)!
    for (let i = 0; i < 400; i++) step(grid, 0.1)
    expect(centre.kind).toBe('blood')
    expect(centre.amount).toBe(1)
  })

  it('oil still decays away (control)', () => {
    const grid = grownPool('oil')
    const centre = grid.cellAt(10, 10)!
    expect(centre.kind).toBe('oil') // grown, present
    for (let i = 0; i < 400; i++) step(grid, 0.1) // past lifetime 30 + fade
    expect(centre.kind).toBeNull()
  })
})
