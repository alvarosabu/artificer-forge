// apps/playground/utils/surfaces/grid.ts
import type { ChargeSource, SurfaceCell, SurfaceKind, SurfaceSource } from './types'
import { emptyCell, KIND_CONFIG } from './types'

export interface SeedOpts {
  /** Override spread radius (cells). Defaults to the kind's defaultRadius. */
  radius?: number
  /** Override starting amount (0..1). Defaults to 1. */
  amount?: number
}

/** Public shape of a surface grid (factory + closure state, no class — repo convention). */
export interface SurfaceGrid {
  readonly cols: number
  readonly rows: number
  readonly cellSize: number
  readonly originX: number
  readonly originZ: number
  /** Flat cell buffer (row-major). Mutated in place by the sim. */
  readonly cells: SurfaceCell[]
  /** Active spreading liquid sources. Mutated in place by the sim. */
  readonly sources: SurfaceSource[]
  /** Active lightning charges holding pools electrified. Mutated in place by the sim. */
  readonly chargeSources: ChargeSource[]
  index: (col: number, row: number) => number
  inBounds: (col: number, row: number) => boolean
  cellAt: (col: number, row: number) => SurfaceCell | null
  cellToWorld: (col: number, row: number) => { x: number, z: number }
  worldToCell: (x: number, z: number) => { col: number, row: number }
  sample: (x: number, z: number) => SurfaceCell
  /** Flat indices of in-bounds cells within `radius` cells of (col,row). */
  cellsInDisc: (col: number, row: number, radius: number) => number[]
  stampDisc: (col: number, row: number, kind: SurfaceKind, radius: number, amount: number, lifetime: number) => void
  seed: (x: number, z: number, kind: SurfaceKind, opts?: SeedOpts) => void
  clear: () => void
}

export function createSurfaceGrid(
  cols: number,
  rows: number,
  cellSize: number,
  // Default: field centred on world origin.
  originX = -(cols * cellSize) / 2,
  originZ = -(rows * cellSize) / 2,
): SurfaceGrid {
  const cells: SurfaceCell[] = Array.from({ length: cols * rows }, emptyCell)
  const sources: SurfaceSource[] = []
  const chargeSources: ChargeSource[] = []

  const index = (col: number, row: number) => row * cols + col
  const inBounds = (col: number, row: number) => col >= 0 && col < cols && row >= 0 && row < rows
  const cellAt = (col: number, row: number): SurfaceCell | null =>
    inBounds(col, row) ? cells[index(col, row)] : null

  const cellToWorld = (col: number, row: number) => ({
    x: originX + (col + 0.5) * cellSize,
    z: originZ + (row + 0.5) * cellSize,
  })

  const worldToCell = (x: number, z: number) => ({
    col: Math.floor((x - originX) / cellSize),
    row: Math.floor((z - originZ) / cellSize),
  })

  const sample = (x: number, z: number): SurfaceCell => {
    const { col, row } = worldToCell(x, z)
    return cellAt(col, row) ?? emptyCell()
  }

  const cellsInDisc = (col: number, row: number, radius: number): number[] => {
    const r = Math.max(0, Math.floor(radius))
    const out: number[] = []
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue
        if (inBounds(col + dx, row + dy)) out.push(index(col + dx, row + dy))
      }
    }
    return out
  }

  /** Stamp a filled disc of `kind` of `radius` cells around (col,row). Empty cells only. */
  const stampDisc = (col: number, row: number, kind: SurfaceKind, radius: number, amount: number, lifetime: number) => {
    for (const idx of cellsInDisc(col, row, radius)) {
      const cell = cells[idx]!
      if (cell.kind !== null) continue
      cell.kind = kind
      cell.amount = amount
      cell.lifetime = lifetime
    }
  }

  const seed = (x: number, z: number, kind: SurfaceKind, opts: SeedOpts = {}) => {
    const { col, row } = worldToCell(x, z)
    if (!inBounds(col, row)) return
    const cfg = KIND_CONFIG[kind]
    const amount = opts.amount ?? 1
    const radius = opts.radius ?? cfg.defaultRadius

    if (cfg.spreadSpeed > 0) {
      // Spreading liquid: 1-cell seed now + a growing source that expands to targetRadius.
      stampDisc(col, row, kind, 0, amount, Number.POSITIVE_INFINITY)
      sources.push({ col, row, kind, radius: 0, targetRadius: radius, speed: cfg.spreadSpeed, growing: true })
    }
    else {
      // Instant stamp (fire): full disc immediately, finite lifetime.
      stampDisc(col, row, kind, radius, amount, cfg.baseLifetime)
    }
  }

  const clear = () => {
    for (const c of cells) {
      c.kind = null
      c.amount = 0
      c.lifetime = 0
      c.electrified = 0
      c.frozen = false
    }
    sources.length = 0
    chargeSources.length = 0
  }

  return {
    cols, rows, cellSize, originX, originZ, cells, sources, chargeSources,
    index, inBounds, cellAt, cellToWorld, worldToCell, sample, cellsInDisc, stampDisc, seed, clear,
  }
}