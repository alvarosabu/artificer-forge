import { TresColor } from '@tresjs/core'
import { BufferAttribute, Color, DoubleSide, InstancedBufferAttribute, InstancedBufferGeometry, Sphere, Texture, Vector3 } from 'three'
import { attribute, float, Fn, If, mix, positionGeometry, rotateUV, texture, uniform, varying, vec2, vec3 } from 'three/tsl'
import { MeshBasicNodeMaterial, MeshLambertNodeMaterial } from 'three/webgpu'
import { ImprovedNoise } from 'three/examples/jsm/math/ImprovedNoise.js'
import type { ColorRepresentation, UniformNode } from 'three/webgpu'
import { createWindUniforms, windOffset, type WindSettings, type WindUniforms } from '../wind/wind'
import { trampleUv, type TrampleMap } from '../../trample/trample'
import type { GradingContext } from '../../grading/grading'
import { createDropShadowCatcher, stylizedOutput } from '../../grading/stylizedOutput'
import { HeightField } from '../../terrain/heightField'
import { sampleHeight } from '../../terrain/heightField'
import { ControlMap, controlUv } from '../../terrain/controlMap'
import { createScatterBake, MASK_EPSILON, PUNT_Y } from '../scatter/density'
import { followAnchor, followFade, followFadeIn, type ScatterFocus } from '../scatter/focus'

const BLADE_DEFAULTS = {
  width: 0.1,
  height: 0.6,
  heightRandomness: 0.6,
  shadowIntensity: 0.5,
}

// `curved` (3 tris) bends along its length, `flat` (1 tri) hinges at the base. Same blade
// count either way; at 10+ blades/m² a blade is ~1px wide, so `flat` is the free choice there.
const BLADE_TEMPLATES = {
  curved: {
    positions: new Float32Array([
      -1, 0, 0,
      1, 0, 0,
      -0.5, 0.7, 0,
      0.5, 0.7, 0,
      0, 1, 0,
    ]),
    windWeight: new Float32Array([0, 0, 0.7, 0.7, 1]),
    indices: [0, 1, 2, 1, 3, 2, 2, 3, 4],
  },
  flat: {
    positions: new Float32Array([
      -1, 0, 0,
      1, 0, 0,
      0, 1, 0,
    ]),
    windWeight: new Float32Array([0, 0, 1]),
    indices: [0, 1, 2],
  },
} as const

export type BladeDetail = keyof typeof BLADE_TEMPLATES

export interface GrassOptions extends WindSettings {
    subdivisions: number
    size: number
    colorA: TresColor
    colorB: TresColor
    diffuseMap?: Texture | null
    /** World extent the diffuse map spans (default `size`). A following field must map the splat over the level, not the window. */
    diffuseMapSize?: number
    trample?: TrampleMap | null
    grading?: GradingContext | null
    heightField?: HeightField | null
    control?: ControlMap | null
    maskLow?: number
    maskHigh?: number
    /** Turns the field into a `size` x `size` window that follows the focus. See scatter/focus. */
    focus?: ScatterFocus | null
    /** The only lever that cuts triangles without changing blade density. See BLADE_TEMPLATES. */
    bladeDetail?: BladeDetail
    /**
     * Hole of this window size in the middle, fading in over the band a field of that size
     * fades out over. Set it to the inner ring's `size` and give both rings the same blades per m².
     */
    innerSize?: number
    /** half-width: the template spans x = ±1 */
    bladeWidth?: number
    bladeHeight?: number
    bladeHeightRandomness?: number
    shadowIntensity?: number
}

export function createGrassGeometry(options: GrassOptions) {
  const { subdivisions, size } = options
  const count = subdivisions * subdivisions
  const fragmentSize = size / subdivisions
  const anchors = new Float32Array(count * 2)
  const randoms = new Float32Array(count)
  const yaws = new Float32Array(count)
  // baked here instead of per-vertex in the shader
  const heightNoises = new Float32Array(count)
  const colorNoises = new Float32Array(count)
  const noise = new ImprovedNoise()

  for (let iX = 0; iX < subdivisions; iX++) {
    for (let iZ = 0; iZ < subdivisions; iZ++) {
      const i = iX * subdivisions + iZ

      anchors[i * 2] = (iX + 0.5) / subdivisions * size - size / 2 + (Math.random() - 0.5) * fragmentSize
      anchors[i * 2 + 1] = (iZ + 0.5) / subdivisions * size - size / 2 + (Math.random() - 0.5) * fragmentSize
      randoms[i] = Math.random()
      yaws[i] = Math.random() * Math.PI * 2
      // height noise in [0.5, 1.5], color noise in [0, 1]
      heightNoises[i] = noise.noise(anchors[i * 2] * 0.0321, anchors[i * 2 + 1] * 0.0321, 0) * 0.5 + 1
      colorNoises[i] = noise.noise(anchors[i * 2] * 0.02, anchors[i * 2 + 1] * 0.02, 0) * 0.5 + 0.5
    }
  }

  // Sort by control mask and draw only the live prefix. The vertex stage punts those blades
  // anyway, so this only removes dead work (over half the field is road, water and off-band).
  const bake = createScatterBake({
    count,
    anchors,
    attributes: [
      { array: randoms, stride: 1 },
      { array: yaws, stride: 1 },
      { array: heightNoises, stride: 1 },
      { array: colorNoises, stride: 1 },
    ],
    control: options.control,
    maskLow: options.maskLow ?? 0.25,
    maskHigh: options.maskHigh ?? 0.6,
    // the mask moves with the window, so a following field cannot be pre-sorted; every blade is drawn
    moving: !!options.focus,
  })

  const blade = BLADE_TEMPLATES[options.bladeDetail ?? 'curved']
  const geometry = new InstancedBufferGeometry()
  geometry.instanceCount = count
  geometry.setIndex([...blade.indices])
  geometry.setAttribute('position', new BufferAttribute(blade.positions, 3))
  geometry.setAttribute('windWeight', new BufferAttribute(blade.windWeight, 1))
  const instanced = [
    new InstancedBufferAttribute(anchors, 2),
    new InstancedBufferAttribute(randoms, 1),
    new InstancedBufferAttribute(yaws, 1),
    new InstancedBufferAttribute(heightNoises, 1),
    new InstancedBufferAttribute(colorNoises, 1),
  ]
  geometry.setAttribute('anchor', instanced[0])
  geometry.setAttribute('random', instanced[1])
  geometry.setAttribute('yaw', instanced[2])
  geometry.setAttribute('heightNoise', instanced[3])
  geometry.setAttribute('colorNoise', instanced[4])
  // half-diagonal plus a sway/height margin, so frustum culling can skip the draw
  geometry.boundingSphere = new Sphere(new Vector3(), (size / 2) * Math.SQRT2 + 2)

  const rebake = (low: number, high: number) => {
    if (!bake.rebake(low, high)) return false
    for (const a of instanced) a.needsUpdate = true
    return true
  }

  return { geometry, bake, rebake }
}

export function buildGrassMaterial(options: {
  colorAUniform: UniformNode<'color', Color>,
  colorBUniform: UniformNode<'color', Color>,
  windUniforms: WindUniforms,
  diffuseMap?: Texture | null,
  diffuseMapSize: number,
  trample?: TrampleMap | null,
  grading?: GradingContext | null,
  heightField?: HeightField | null,
  control?: ControlMap | null,
  maskLow?: UniformNode<'float', number> | null,
  maskHigh?: UniformNode<'float', number> | null,
  size: number,
  focus?: ScatterFocus | null,
  innerSize?: number,
  bladeWidth: UniformNode<'float', number>,
  bladeHeight: UniformNode<'float', number>,
  bladeHeightRandomness: UniformNode<'float', number>,
  shadowIntensity: UniformNode<'float', number>,
}) {
    const { colorAUniform, colorBUniform, windUniforms, diffuseMap, diffuseMapSize, trample, grading, heightField, control, maskLow, maskHigh, size, focus, innerSize, bladeWidth, bladeHeight, bladeHeightRandomness, shadowIntensity } = options
    // Lambert only so the drop-shadow catcher runs
    const material = grading ? new MeshLambertNodeMaterial() : new MeshBasicNodeMaterial()
    material.side = DoubleSide
    const grassWindOffset = windOffset(windUniforms)

    const anchor = attribute<'vec2'>('anchor', 'vec2')
    const windWeight = attribute<'float'>('windWeight', 'float')
    // post-wrap XZ, so the diffuse splat is sampled where the blade actually stands
    const bladeXZ = varying(vec2(), 'bladeXZ')

    const groundColor = mix(colorAUniform, colorBUniform, attribute<'float'>('colorNoise', 'float'))

    material.positionNode = Fn(() => {
        const random = attribute<'float'>('random', 'float')
        const yaw = attribute<'float'>('yaw', 'float')

        const worldXZ = (focus ? followAnchor(focus, anchor, size) : anchor).toVar()
        bladeXZ.assign(worldXZ)

        const visible = control ?
          texture(control.texture, controlUv(control.uniforms, worldXZ))
              .g.smoothstep(maskLow, maskHigh).toVar()
        : float(1).toVar()
        // blades shrink into the ground at the wrap boundary instead of popping;
        // innerSize runs the same ramp inwards to carve the hole the finer ring fills
        let fadeNode = focus ? followFade(focus, worldXZ, size) : null
        if (fadeNode && innerSize) fadeNode = fadeNode.mul(followFadeIn(focus!, worldXZ, innerSize))
        const fade = fadeNode ? fadeNode.toVar() : null
        if (fade) visible.mulAssign(fade)

        // Early-out: the CPU bake cannot cull a following field (see scatter/density), so dead
        // blades skip the rest here. Lattice order keeps the mask coherent, so the branch is cheap.
        const pos = vec3(0, PUNT_Y, 0).toVar()

        If(visible.greaterThanEqual(MASK_EPSILON), () => {
            const trampleAmt = trample ? texture(trample.texture, trampleUv(trample.uniforms, worldXZ)).r.toVar() : null

            const heightVariation = attribute<'float'>('heightNoise', 'float')
            let height = bladeHeight
              .mul(mix(1, random, bladeHeightRandomness))
              .mul(heightVariation)
              .mul(heightVariation)
            if (trampleAmt) height = height.mul(trampleAmt.mul(0.75).oneMinus())
            if (fade) height = height.mul(fade)
            height = height.toVar()

            const local = vec3(
              positionGeometry.x.mul(bladeWidth).mul(visible),
              positionGeometry.y.mul(height),
              0,
            ).toVar()
            local.xz.assign(rotateUV(local.xz, yaw, vec2(0)))

            pos.assign(vec3(local.x.add(worldXZ.x), local.y, local.z.add(worldXZ.y)))
            if (heightField) pos.y.addAssign(sampleHeight(heightField, worldXZ))

            let windVec = grassWindOffset(worldXZ).mul(height).mul(2)
            if (trampleAmt) windVec = windVec.mul(trampleAmt.oneMinus())
            windVec = windVec.toVar()
            pos.addAssign(vec3(windVec.x.mul(windWeight), 0, windVec.y.mul(windWeight)))
            // arc approximation |w|²/2h so blades bend instead of stretching; the clamp keeps gusts from flattening them
            const droop = windVec.dot(windVec).div(height.mul(2).max(1e-4)).min(height.mul(0.35))
            pos.y.subAssign(droop.mul(windWeight).mul(windWeight))

            if (trample) {
              const toBlade = worldXZ.sub(trample.uniforms.interactor)
              const dist = toBlade.length().max(1e-3)
              const push = dist.div(trample.uniforms.interactorRadius).oneMinus().max(0)
              pos.addAssign(vec3(toBlade.x.div(dist), 0, toBlade.y.div(dist)).mul(push.mul(push)).mul(windWeight).mul(0.5))
              pos.y.subAssign(push.mul(push).mul(height).mul(0.3).mul(windWeight))
            }
        })

        return pos
    })()

    const diffuseMapNode = diffuseMap
      ? texture(diffuseMap, bladeXZ.div(diffuseMapSize).add(0.5))
      : null

    // evaluated in the vertex stage: one flat colour per blade
    const base = varying(diffuseMapNode ? diffuseMapNode.rgb : groundColor)

    if (grading) {
        // bent-blade normals are noisy, so no core shadows; root darkening goes through
        // the finish AO so it re-grades with the day cycle
        const rootAo = varying(windWeight).oneMinus().mul(shadowIntensity).oneMinus()
        const dropShadow = createDropShadowCatcher()
        material.receivedShadowNode = dropShadow.receivedShadowNode
        material.outputNode = stylizedOutput(base, grading, { hasCoreShadows: false, aoNode: rootAo, dropShadowNode: dropShadow.shadowFactor })
    }
    else {
        const ao = varying(windWeight).oneMinus().mul(shadowIntensity)
        material.colorNode = mix(base, base.mul(0.35), ao)  // 0.35 = shadow darkness, tune in leches
    }
    // returned so a texture swap can reach it without a rebuild
    return { material, diffuseMapNode }
}

export function createGrass(options: GrassOptions) {
    const { geometry, bake, rebake } = createGrassGeometry(options)
    const colorAUniform = uniform(new Color(options.colorA as ColorRepresentation))
    const colorBUniform = uniform(new Color(options.colorB as ColorRepresentation))
    const maskLow = uniform(options.maskLow ?? 0.25)
    const maskHigh = uniform(options.maskHigh ?? 0.6)
    const windUniforms = createWindUniforms(options)
    // per-field, not module-level: two rings of one lawn need different blade widths
    const bladeWidth = uniform(options.bladeWidth ?? BLADE_DEFAULTS.width)
    const bladeHeight = uniform(options.bladeHeight ?? BLADE_DEFAULTS.height)
    const bladeHeightRandomness = uniform(options.bladeHeightRandomness ?? BLADE_DEFAULTS.heightRandomness)
    const shadowIntensity = uniform(options.shadowIntensity ?? BLADE_DEFAULTS.shadowIntensity)

    const { material, diffuseMapNode } = buildGrassMaterial({
      colorAUniform,
      colorBUniform,
      windUniforms,
      diffuseMap: options.diffuseMap,
      diffuseMapSize: options.diffuseMapSize ?? options.size,
      trample: options.trample,
      grading: options.grading,
      heightField: options.heightField,
      control: options.control,
      maskLow,
      maskHigh,
      size: options.size,
      focus: options.focus,
      innerSize: options.innerSize,
      bladeWidth,
      bladeHeight,
      bladeHeightRandomness,
      shadowIntensity,
    })
    // MASK_EPSILON is the same cutoff the vertex stage punts at, so nothing visible is dropped
    const applyMaskBand = () => {
      if (bake.coverage) geometry.instanceCount = bake.countFor(MASK_EPSILON)
    }
    applyMaskBand()

    const setMaskBand = (low: number, high: number) => {
      maskLow.value = low
      maskHigh.value = high
      if (rebake(low, high)) applyMaskBand()
    }

    const uniforms = {
        bladeWidth,
        bladeHeight,
        bladeHeightRandomness,
        shadowIntensity,
        colorA: colorAUniform,
        colorB: colorBUniform,
        diffuseMap: diffuseMapNode,
        wind: windUniforms,
        grading: options.grading,
    }
    return { geometry, material, uniforms, setMaskBand, dispose: () => {
        geometry.dispose()
        material.dispose()
    } }
}
