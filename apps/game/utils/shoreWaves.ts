import { asin, exp, fract, sin, smoothstep, step, time, uniform } from 'three/tsl'
import type { Node } from 'three/webgpu'

export function createShoreWaves() {
  return {
    /** metres from the rest level to a crest */
    height: uniform(0.15),
    /** wave crests per metre of water depth */
    frequency: uniform(3),
    /** seconds between two crests reaching the same spot */
    period: uniform(4),
    /** metres of water after which the waves stop rising */
    reach: uniform(3),
    /** metres above sea level that a wave can climb up the beach */
    runUp: uniform(0.4),
    /** metres from the player where the waves start to flatten */
    detailNear: uniform(15),
    /** metres from the player where the sea is flat. Keep the rings here under ~1 m apart */
    detailFar: uniform(30),
    /** a wave breaks once crest-to-trough height is this share of the water depth */
    breakRatio: uniform(0.78),
    /** how much of a breaking wave, from the crest down, is foam. 0.5 is half the wave */
    crestFoam: uniform(0.2),
    crestLight: uniform(0.35),
    /** seconds for wet sand to dry back once the water leaves it */
    dryTime: uniform(3),
    /** how far wet sand goes toward the terrain's wetGround colour */
    wetStrength: uniform(0.5),
  }
}

export type ShoreWaves = ReturnType<typeof createShoreWaves>

export function wavePhase(waves: ShoreWaves, seaDepth: Node<'float'>) {
  // + time, not - time: the phase a crest carries moves to smaller depths, so toward the beach
  return seaDepth.max(0).sqrt().mul(waves.frequency).add(time.mul(2 * Math.PI).div(waves.period))
}

export function waveAmplitude(waves: ShoreWaves, seaDepth: Node<'float'>, playerDistance: Node<'float'>) {
  const shoaling = waves.reach.div(seaDepth.max(0.2)).pow(0.25)
  const offshoreFade = smoothstep(waves.reach.mul(0.5), waves.reach, seaDepth).oneMinus()
  const landFade = smoothstep(waves.runUp.negate(), 0, seaDepth)
  // The rings get wider with distance, and a wave drawn with too few vertices turns into
  // saw teeth. So the waves flatten before the rings get too coarse for them.
  const detailFade = smoothstep(waves.detailNear, waves.detailFar, playerDistance).oneMinus()
  return waves.height.mul(shoaling).mul(offshoreFade).mul(landFade).mul(detailFade)
}

/** 0 for dry sand, `wetStrength` while the water covers it, fading back over `dryTime` after. */
export function sandWetness(waves: ShoreWaves, seaDepth: Node<'float'>, playerDistance: Node<'float'>) {
  const phase = wavePhase(waves, seaDepth)
  // The water covers this point while sin(phase) is at least coverAt
  const coverAt = seaDepth.negate().div(waveAmplitude(waves, seaDepth, playerDistance).max(1e-4))
  const covered = step(coverAt, sin(phase))
  const everReached = step(coverAt, 1)
  // sin(phase) drops back below coverAt at phase π - asin(coverAt)
  const leaveAt = asin(coverAt.clamp(-1, 1)).negate().add(Math.PI)
  const sinceLeft = fract(phase.sub(leaveAt).div(2 * Math.PI)).mul(waves.period)
  const drying = exp(sinceLeft.div(waves.dryTime).negate())
  return covered.max(drying).mul(everReached).mul(waves.wetStrength)
}
