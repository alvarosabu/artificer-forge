import type { SurfaceCell, SurfaceKind, SurfaceStatusId } from './types'
import { KIND_CONFIG } from './types'

export function isFlammable(kind: SurfaceKind): boolean {
  return KIND_CONFIG[kind].flammable
}

export type FireInteraction = 'ignite' | 'extinguish' | 'melt' | 'none'

/** What fire does when it reaches a cell holding `target`. */
export function fireInteraction(target: SurfaceCell): FireInteraction {
  if (target.kind === null) return 'none'
  if (target.frozen) return 'melt' // ice → water
  if (target.kind === 'water') return 'extinguish'
  if (isFlammable(target.kind)) return 'ignite'
  return 'none'
}

/** The status a surface inflicts on an entity standing in it (null = none). */
export function statusForCell(cell: SurfaceCell): SurfaceStatusId | null {
  if (cell.kind === null) return null
  if (cell.frozen) return null // ice = slippery, no status in v1
  if (cell.kind === 'fire') return 'burning'
  if (cell.kind === 'poison') return 'poisoned'
  if (cell.electrified > 0 && (cell.kind === 'water' || cell.kind === 'blood')) return 'stunned'
  if (cell.kind === 'water' || cell.kind === 'blood') return 'wet'
  if (cell.kind === 'oil') return 'slowed'
  return null
}