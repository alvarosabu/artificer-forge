import { describe, expect, it } from 'vitest'
import { createSurfaceGrid } from '../utils/surfaces/grid'
import { applyEvent, step } from '../utils/surfaces/sim'
import { CHARGE_HOLD } from '../utils/surfaces/types'

// World (0,0) is cell (10,10) on a 20x20 centred grid.
function waterPool() {
  const grid = createSurfaceGrid(20, 20, 1)
  grid.stampDisc(10, 10, 'water', 3, 1, Number.POSITIVE_INFINITY)
  return grid
}

describe('lightning charge-source', () => {
  it('electrifies the whole connected pool', () => {
    const grid = waterPool()
    applyEvent(grid, 0, 0, 'lightning')
    expect(grid.cellAt(10, 10)!.electrified).toBe(1)
    expect(grid.cellAt(12, 10)!.electrified).toBe(1) // within radius 3
    expect(grid.chargeSources.length).toBe(1)
  })

  it('holds full charge for CHARGE_HOLD seconds', () => {
    const grid = waterPool()
    applyEvent(grid, 0, 0, 'lightning')
    const centre = grid.cellAt(10, 10)!
    // Step to just before the hold expires (re-armed every tick).
    for (let i = 0; i < Math.floor((CHARGE_HOLD - 0.2) / 0.1); i++) step(grid, 0.1)
    expect(centre.electrified).toBe(1)
  })

  it('fades after the hold expires, then clears the source', () => {
    const grid = waterPool()
    applyEvent(grid, 0, 0, 'lightning')
    const centre = grid.cellAt(10, 10)!
    for (let i = 0; i < Math.ceil(CHARGE_HOLD / 0.1) + 2; i++) step(grid, 0.1)
    expect(grid.chargeSources.length).toBe(0)
    const afterExpiry = centre.electrified
    expect(afterExpiry).toBeLessThan(1)
    step(grid, 0.1)
    expect(centre.electrified).toBeLessThan(afterExpiry) // still decaying
  })

  it('no-ops over empty ground', () => {
    const grid = createSurfaceGrid(20, 20, 1)
    applyEvent(grid, 0, 0, 'lightning')
    expect(grid.chargeSources.length).toBe(0)
  })

  it('a permanent charge source (Infinity lifetime) never expires', () => {
    // How a declarative `electrified: true` pool stays lit — see useSurface.hydrate.
    const grid = waterPool()
    const cells = grid.cellsInDisc(10, 10, 3).filter(i => grid.cells[i]!.kind === 'water')
    grid.chargeSources.push({ cells, lifetime: Number.POSITIVE_INFINITY })
    const centre = grid.cellAt(10, 10)!
    for (let i = 0; i < 1000; i++) step(grid, 0.1) // ~100s
    expect(grid.chargeSources.length).toBe(1)
    expect(centre.electrified).toBe(1)
  })
})
