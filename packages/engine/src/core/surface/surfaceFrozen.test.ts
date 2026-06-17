import { describe, expect, it } from 'vitest'
import { createSurfaceGrid } from './grid'
import { step } from './sim'

describe('frozen cells pause decay', () => {
  it('a frozen finite-lifetime cell does not age', () => {
    const grid = createSurfaceGrid(10, 10, 1)
    grid.stampDisc(5, 5, 'oil', 0, 1, 30) // oil normally decays
    const cell = grid.cellAt(5, 5)!
    cell.frozen = true
    for (let i = 0; i < 400; i++) step(grid, 0.1) // ~40s, well past lifetime 30
    expect(cell.kind).toBe('oil')
    expect(cell.lifetime).toBe(30) // countdown never ran
  })

  it('charge still drains on a frozen cell', () => {
    const grid = createSurfaceGrid(10, 10, 1)
    grid.stampDisc(5, 5, 'oil', 0, 1, 30)
    const cell = grid.cellAt(5, 5)!
    cell.frozen = true
    cell.electrified = 0.8
    for (let i = 0; i < 20; i++) step(grid, 0.1) // 2s @ 0.5/s ⇒ fully drained
    expect(cell.electrified).toBe(0)
  })

  it('fire melts a frozen water cell back to permanent water', () => {
    const grid = createSurfaceGrid(10, 10, 1)
    grid.stampDisc(5, 5, 'water', 0, 1, Number.POSITIVE_INFINITY)
    grid.cellAt(5, 5)!.frozen = true
    grid.stampDisc(6, 5, 'fire', 0, 1, 6) // adjacent fire
    step(grid, 0.1)
    const melted = grid.cellAt(5, 5)!
    expect(melted.kind).toBe('water')
    expect(melted.frozen).toBe(false)
    expect(melted.lifetime).toBe(Number.POSITIVE_INFINITY)
  })
})
