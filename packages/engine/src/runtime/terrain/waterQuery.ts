import { CONTROL_CHANNEL, readControlPixels, sampleControlChannel, type ControlMap } from './controlMap'
import type { WaterUniforms } from './waterMaterial'

/** Height of the water surface at a world XZ, or null where there is no water. */
export type WaterQuery = (x: number, z: number) => number | null

/**
 * Where a Water plane draws water, as a CPU query: the control map's water channel,
 * cut at the middle of the material's mask edge. `level` is a getter so a live-tuned level is read fresh.
 */
export function createWaterQuery(control: ControlMap, level: () => number, uniforms: WaterUniforms): WaterQuery {
  return (x, z) => {
    const pixels = readControlPixels(control)
    if (!pixels) return null
    const coverage = sampleControlChannel(control, pixels, x, z, CONTROL_CHANNEL.water)
    const edge = (uniforms.maskLow.value + uniforms.maskHigh.value) / 2
    return coverage >= edge ? level() : null
  }
}

/** The highest surface any of the queries reports at a point. */
export function combineWaterQueries(...queries: WaterQuery[]): WaterQuery {
  return (x, z) => {
    let surface: number | null = null
    for (const query of queries) {
      const level = query(x, z)
      if (level !== null && (surface === null || level > surface)) surface = level
    }
    return surface
  }
}