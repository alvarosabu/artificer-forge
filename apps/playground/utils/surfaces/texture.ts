import type { SurfaceCell } from './types'

/** R=water G=oil B=poison A=blood. One scalar channel per kind because the
 *  texture is bilinear-filtered — kind ids would interpolate into other kinds. */
export function packCells(cells: SurfaceCell[], data: Float32Array): void {
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i]!
    const o = i * 4
    data[o] = c.kind === 'water' ? c.amount : 0
    data[o + 1] = c.kind === 'oil' ? c.amount : 0
    data[o + 2] = c.kind === 'poison' ? c.amount : 0
    data[o + 3] = c.kind === 'blood' ? c.amount : 0
  }
}

/** Fire amount in R; G/B/A unused. Separate texture because liquid RGBA is full. */
export function packFire(cells: SurfaceCell[], data: Float32Array): void {
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i]!
    data[i * 4] = c.kind === 'fire' ? c.amount : 0
    data[i * 4 + 1] = 0
    data[i * 4 + 2] = 0
    data[i * 4 + 3] = 0
  }
}

/** Pool variant state: R=electrified charge (0..1), G=frozen (0/1); B/A unused.
 *  Drives the icy/electric branches in buildPoolSurfaceMaterial. */
export function packState(cells: SurfaceCell[], data: Float32Array): void {
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i]!
    data[i * 4] = c.electrified
    data[i * 4 + 1] = c.frozen ? 1 : 0
    data[i * 4 + 2] = 0
    data[i * 4 + 3] = 0
  }
}