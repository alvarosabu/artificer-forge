import type { SurfaceEvent } from './types'
import { KIND_CONFIG } from './types'
import { fireInteraction, isFlammable } from './matrix'
import type { SurfaceGrid } from './grid'

const ELECTRIFY_DECAY = 0.5 // charge lost per second
const FADE_RATE = 0.6 // amount lost per second once lifetime hits 0

export function step(grid: SurfaceGrid, dt: number): void {
  growSources(grid, dt)
  fireContagion(grid)
  decay(grid, dt)
}

function growSources(grid: SurfaceGrid, dt: number): void {
  for (const src of grid.sources) {
    if (!src.growing) continue
    src.radius = Math.min(src.targetRadius, src.radius + src.speed * dt)
    const cfg = KIND_CONFIG[src.kind]
    grid.stampDisc(src.col, src.row, src.kind, src.radius, 1, Number.POSITIVE_INFINITY)
    if (src.radius >= src.targetRadius) {
      src.growing = false
      // hand every cell of this kind a finite lifetime so decay can reclaim it
      for (const cell of grid.cells) {
        if (cell.kind === src.kind && !Number.isFinite(cell.lifetime)) {
          cell.lifetime = cfg.baseLifetime
        }
      }
    }
  }
}

function fireContagion(grid: SurfaceGrid): void {
  // Snapshot fire cells first so newly-ignited cells don't cascade within one tick.
  const ignite: number[] = []
  const extinguish: number[] = []
  const melt: number[] = []
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      const cell = grid.cellAt(col, row)!
      if (cell.kind !== 'fire') continue
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const n = grid.cellAt(col + dx, row + dy)
        if (!n) continue
        const result = fireInteraction(n)
        const idx = grid.index(col + dx, row + dy)
        if (result === 'ignite') ignite.push(idx)
        else if (result === 'extinguish') extinguish.push(grid.index(col, row))
        else if (result === 'melt') melt.push(idx)
      }
    }
  }
  for (const idx of ignite) {
    const c = grid.cells[idx]
    if (!c.kind || !isFlammable(c.kind)) continue
    const hot = c.kind === 'oil'
    c.kind = 'fire'
    c.lifetime = KIND_CONFIG.fire.baseLifetime * (hot ? 1.5 : 1)
    c.frozen = false
  }
  for (const idx of melt) {
    const c = grid.cells[idx]
    c.frozen = false
    c.kind = 'water'
    c.lifetime = KIND_CONFIG.water.baseLifetime
  }
  for (const idx of extinguish) {
    const c = grid.cells[idx]
    c.kind = null
    c.amount = 0
    c.lifetime = 0
  }
}

/** Flood-fill the connected pool of the same liquid kind under (x,z) and convert it. */
export function applyEvent(grid: SurfaceGrid, x: number, z: number, event: SurfaceEvent): void {
  const start = grid.worldToCell(x, z)
  const origin = grid.cellAt(start.col, start.row)
  if (!origin || origin.kind === null || !KIND_CONFIG[origin.kind].liquid) return
  const kind = origin.kind
  const seen = new Set<number>()
  const stack = [[start.col, start.row] as const]
  while (stack.length) {
    const [col, row] = stack.pop()!
    const idx = grid.index(col, row)
    if (seen.has(idx)) continue
    const cell = grid.cellAt(col, row)
    if (!cell || cell.kind !== kind) continue
    seen.add(idx)
    if (event === 'lightning') cell.electrified = 1
    else cell.frozen = true
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      if (grid.inBounds(col + dx, row + dy)) stack.push([col + dx, row + dy])
    }
  }
}

function decay(grid: SurfaceGrid, dt: number): void {
  for (const cell of grid.cells) {
    if (cell.kind === null) continue
    if (cell.electrified > 0) cell.electrified = Math.max(0, cell.electrified - ELECTRIFY_DECAY * dt)
    if (!Number.isFinite(cell.lifetime)) continue // still growing
    cell.lifetime -= dt
    if (cell.lifetime <= 0) {
      cell.amount -= FADE_RATE * dt
      if (cell.amount <= 0) {
        cell.kind = null
        cell.amount = 0
        cell.lifetime = 0
        cell.electrified = 0
        cell.frozen = false
      }
    }
  }
}