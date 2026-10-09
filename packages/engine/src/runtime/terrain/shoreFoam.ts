import { fwidth, smoothstep, step, time, uniform } from 'three/tsl'
import { Color } from 'three'
import type { Node } from 'three/webgpu'

/**
 * The shoreline foam knobs. Spread into a water surface's own uniform bag, so a
 * debug panel writes `.value` on them like on every other water knob.
 */
export function createFoamUniforms() {
  return {
    /**
     * The foam colour. Deliberately not pure white: the mix goes all the way to
     * this, so at #ffffff the sun glitter has nowhere left to go and vanishes
     * exactly where the surface is brightest. Its brightness IS the foam
     * strength, which is why there is no separate strength uniform.
     */
    foamColor: uniform(new Color('#e8f4f2')),
    /** metres of water the foam band reaches out to. Beyond this, no foam */
    foamDepth: uniform(0.3),
    /** metres the surface pushes the band up and down the beach */
    foamWobble: uniform(0.27),
    /** roughly how many stripes fit inside the band */
    foamLines: uniform(1),
    /** width of one stripe, as a fraction of the gap between them. 1 is no gap */
    foamWidth: uniform(0.02),
    /** stripes per second, travelling toward the shore */
    foamDrift: uniform(0.07),
    /** metres of solid rim hugging the contact line */
    foamEdge: uniform(0.09),
  }
}

export type FoamUniforms = ReturnType<typeof createFoamUniforms>

/**
 * Foam amount (0..1) for a surface fragment that sits `shoreDepth` metres above
 * whatever is under it: a solid rim at the contact line plus stripes that drift
 * toward it. Read the depth from the depth buffer, and the foam comes free
 * around anything that breaks the surface (beach, rocks, a wading player).
 *
 * `shoreDepth` must be metres straight DOWN, with any wobble already added, and
 * never negative.
 */
export function shoreFoam(shoreDepth: Node<'float'>, u: FoamUniforms) {
  // 0 at the waterline, 1 at foamDepth metres: the band, normalised
  const shoreT = shoreDepth.div(u.foamDepth).saturate().toVar()

  // fract turns one climbing value into many identical cycles. The +0.5/-0.5
  // pair puts stripe centres on whole numbers, so the first stripe lands ON the
  // waterline rather than half a gap inside it. `add(time)` rather than `sub`
  // is what sends the stripes toward the beach instead of out to sea.
  const phase = shoreT.mul(u.foamLines).add(time.mul(u.foamDrift)).add(0.5).fract()
  // sawtooth folded into a triangle: symmetric, so the stripe gets two soft
  // sides instead of one soft side and one razor edge
  const saw = phase.sub(0.5).abs().mul(2)
  const lines = smoothstep(0, u.foamWidth, saw).oneMinus()

  // the solid rim: no stripes, just white where the water has almost run out
  const rim = smoothstep(0, u.foamEdge, shoreDepth).oneMinus()

  // oneMinus(shoreT) is the envelope: without it the outermost stripe is as
  // bright as the rest and the band ends on a hard line out in open water.
  // max() rather than add() where the rim and the first stripe overlap, or that
  // one ring clips past 1 and goes flat white.
  return lines.mul(shoreT.oneMinus()).max(rim).saturate()
}

// A hard step, softened by one pixel only, so the edge stays crisp at any distance
// but does not crawl. smoothstep over a fixed range goes blurry up close.
function pixelStep(edge: Node<'float'>, x: Node<'float'>) {
  const aa = fwidth(x)
  return smoothstep(edge.sub(aa), edge.add(aa), x)
}

/**
 * Toon version of shoreFoam: the same rim and drifting stripes, but every pixel
 * is foam or water, with no grey in between. Out to sea the stripes get THINNER
 * instead of fading, and they vanish at foamDepth. Same inputs and uniforms as
 * shoreFoam, so a surface can switch between the two.
 */
export function toonShoreFoam(shoreDepth: Node<'float'>, u: FoamUniforms) {
  const shoreT = shoreDepth.div(u.foamDepth).saturate().toVar()

  // same phase as shoreFoam: stripe centres on whole numbers, drifting to shore
  const phase = shoreT.mul(u.foamLines).add(time.mul(u.foamDrift)).add(0.5).fract()
  // 0 at a stripe centre, 1 halfway to the next one
  const saw = phase.sub(0.5).abs().mul(2)

  // the width IS the envelope here. At shoreT = 1 it is 0, so the last stripe
  // pinches out to nothing instead of ending on a hard line in open water
  const width = u.foamWidth.mul(shoreT.oneMinus())
  // Past foamDepth, shoreT is clamped to 1 and the phase stops changing across the
  // sea. A zero width still lets half a pixel through, so without this mask the
  // whole open sea blinks grey once per stripe cycle.
  const inBand = step(shoreT, 0.999)
  const lines = pixelStep(width, saw).oneMinus().mul(inBand)

  const rim = pixelStep(u.foamEdge, shoreDepth).oneMinus()

  return lines.max(rim)
}
