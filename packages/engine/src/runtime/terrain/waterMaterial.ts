import { cameraFar, cameraNear, cameraPosition, exp, Fn, linearDepth, mix, positionWorld, screenUV, smoothstep, texture, time, uniform, vec2, vec3, vec4, viewportDepthTexture, viewportLinearDepth, viewportSharedTexture } from 'three/tsl'
import { Color, NoColorSpace, RepeatWrapping } from 'three'
import { MeshBasicNodeMaterial, Texture } from 'three/webgpu'
import { controlUv, type ControlMap } from './controlMap'
import type { GradingContext } from '../grading/grading'

/**
 * Every tweakable of the water surface, one uniform each. Same deal as
 * createTerrainUniforms: made per surface, and a debug panel writes straight
 * into `.value` without rebuilding the node graph.
 *
 * The water is a single flat plane that tints whatever is already on screen
 * behind it, so all of this is either "how much light the water eats" or "where
 * the painted blue channel counts as water at all".
 */
export function createWaterUniforms() {
  return {
    /**
     * The colour the water EATS, not the colour it looks. Reddish-orange takes
     * the red out of the backdrop, which is what leaves it reading blue-green.
     */
    absorption: uniform(new Color('#ff5a1e')),
    /** how hard absorption bites per metre of water travelled */
    absorbStrength: uniform(0.55),
    /**
     * Metres of water after which the ramp stops deepening. Also what keeps sky
     * pixels (infinite depth behind the plane) from going black.
     */
    maxDepth: uniform(8),
    /** control-map blue where the surface starts, and where it is fully opaque water */
    maskLow: uniform(0.04),
    maskHigh: uniform(0.28),
    rippleScale: uniform(0.35),
    rippleStrength: uniform(0.6),
    rippleSpeed: uniform(0.04),
    refraction: uniform(0.6),
    /** how bright the specular glitter is on top of the water */
    sunStrength: uniform(1.4),
    /** the specular exponent. High on purpose: a soft sheen reads as plastic */
    sunSharpness: uniform(180),
    /**
     * The foam colour. Deliberately not pure white: the mix goes all the way to
     * this, so at #ffffff the sun glitter has nowhere left to go and vanishes
     * exactly where the surface is brightest. Its brightness IS the foam
     * strength, which is why there is no separate strength uniform.
     */
    foamColor: uniform(new Color('#e8f4f2')),
    /** metres of water the foam band reaches out to. Beyond this, no foam */
    foamDepth: uniform(0.3),
    /** metres the ripple normals push the band up and down the beach */
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

export type WaterUniforms = ReturnType<typeof createWaterUniforms>

function prepareNormalMap(map: Texture) {
  map.wrapS = map.wrapT = RepeatWrapping
  map.colorSpace = NoColorSpace
  map.anisotropy = 4
  map.needsUpdate = true
}

function rippleLayer(map: Texture, u: WaterUniforms, scale: number, driftX: number, driftZ: number) {
  const uv = positionWorld.xz.mul(u.rippleScale.mul(scale))
    .add(vec2(driftX, driftZ).mul(time).mul(u.rippleSpeed))
  const packed = texture(map, uv).xyz.mul(2).sub(1)
  return vec3(packed.x, packed.z, packed.y)
}

/**
 * Builds the water surface material. Same shape as buildTerrainMaterial: hand it
 * a control map, get back the material and the uniform bag driving it.
 *
 * The water writes no colour of its own. It reads whatever is already in the
 * framebuffer behind the plane and eats light out of it in proportion to how much
 * water the view ray crossed, so shallow edges stay near the ground colour and
 * deep parts go blue-green.
 */
export function buildWaterMaterial(options: {
  control: ControlMap
  grading?: GradingContext | null
  normalMap?: Texture
  /** pass one in to tune the look live; omitted, the material makes its own */
  uniforms?: WaterUniforms
}) {
  const { control, normalMap, grading } = options
  const u = options.uniforms ?? createWaterUniforms()

  if (normalMap) {
    prepareNormalMap(normalMap)
  }

  const material = new MeshBasicNodeMaterial()
  material.transparent = true
  // transparent water above opaque ground: never write depth, or it hides itself
  material.depthWrite = false

  const rippleNormal = Fn(() => {
    const a = rippleLayer(normalMap!, u, 1.0, 1.0, 0.35)
    const b = rippleLayer(normalMap!, u, 1.63, -0.45, -0.9)
    // whiteout blend: tilts add, ups multiply. Averaging the vectors instead makes
    // the layers cancel wherever they disagree, which flattens the surface.
    return vec3(
      a.x.add(b.x).mul(u.rippleStrength),
      a.y.mul(b.y),
      a.z.add(b.z).mul(u.rippleStrength),
    ).normalize()
  })

  material.outputNode = Fn(() => {
    const data = texture(control.texture, controlUv(control.uniforms, positionWorld.xz))
    const mask = smoothstep(u.maskLow, u.maskHigh, data.b)

    const normal = (normalMap ? rippleNormal() : vec3(0, 1, 0)).toVar()

    const span = cameraFar.sub(cameraNear)
    const surfaceDepth = linearDepth().toVar()

    // first depth read, straight down: drives the shore fade and all of the foam
    const straightDepth = viewportLinearDepth.sub(surfaceDepth).mul(span).max(0).toVar()

    const eye = cameraPosition.sub(positionWorld).toVar()
    const eyeDist = eye.length().toVar()
    const toEye = eye.div(eyeDist).toVar()

    // world-sized ripples become a screen-space offset, so divide by distance or
    // the far shore refracts as hard as the water at your feet
    const shoreFade = smoothstep(0, 0.6, straightDepth)
    const offset = normal.xz.mul(u.refraction).mul(shoreFade).div(eyeDist)
    const refractUv = screenUV.add(offset).toVar()

    const backdrop = viewportSharedTexture(refractUv).rgb.toVar()

    const throughWater = linearDepth(viewportDepthTexture(refractUv))
      .sub(surfaceDepth).mul(span).max(0).min(u.maxDepth).toVar()

    // Beer-Lambert, one exponent per channel: the reddish-orange coefficient eats
    // red fastest, and what survives is the colour of the water. exp() on a vec3
    // runs per component.
    const transmission = exp(u.absorption.mul(u.absorbStrength).mul(throughWater).negate())
    const out = backdrop.mul(transmission).toVar()

    // ---- foam ----------------------------------------------------------------
    // Ahead of the grading block on purpose: the fog convergence down there is the
    // last thing that runs, so foam put here fades into the haze with everything
    // else instead of burning white lines through it.

    // straightDepth is measured ALONG the view ray, and a low camera crosses far
    // more water for the same drop. The ray's vertical part converts it back to
    // metres down, or the band visibly fattens as you lower the camera.
    const shallow = straightDepth.mul(toEye.y.abs()).toVar()

    // Signed on purpose, so the band breathes IN and out. normal.xz.length() is
    // the tempting version and it is always positive, so it can only ever push
    // the band out to sea. max(0) because a negative depth breaks everything
    // downstream at exactly the pixels that matter most.
    const wobble = normal.x.add(normal.z).mul(u.foamWobble)
    const shoreDepth = shallow.add(wobble).max(0).toVar()

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
    const foam = lines.mul(shoreT.oneMinus()).max(rim).saturate().toVar()
    out.assign(mix(out, u.foamColor, foam))

    if (grading) {
      const g = grading.uniforms
      // lightDirection points FROM the light INTO the scene, so negate it
      const toLight = g.lightDirection.negate()
      const half = toLight.add(toEye).normalize()
      // high power on purpose: a soft sheen reads as plastic, a brutal falloff
      // breaks into the glitter path you see on a lake at low sun
      const sun = normal.dot(half).saturate().pow(u.sunSharpness).mul(u.sunStrength)
      // foam is churned water, and churned water is rough: no mirror, no glitter
      out.addAssign(g.lightColor.mul(g.lightIntensity).mul(sun).mul(foam.oneMinus()))

      // NOT a mix toward fogColor: the backdrop already carries the terrain's fog,
      // so fogging again would haze the lake faster than the ground it sits in.
      // Converging to the backdrop lands on the correctly fogged pixel instead.
      out.assign(mix(out, backdrop, grading.fogStrength))
    }

    return vec4(out, mask)
  })()

  return { material, uniforms: u }
}
