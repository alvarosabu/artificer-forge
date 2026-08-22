import { TresColor } from '@tresjs/core'
import { BufferAttribute, Color, DoubleSide, InstancedBufferAttribute, InstancedBufferGeometry, Sphere, Texture, Vector3 } from 'three'
import { attribute, float, Fn, mix, positionGeometry, rotateUV, texture, uniform, varying, vec2, vec3 } from 'three/tsl'
import { MeshBasicNodeMaterial, MeshLambertNodeMaterial } from 'three/webgpu'
import { ImprovedNoise } from 'three/examples/jsm/math/ImprovedNoise.js'
import type { ColorRepresentation, TextureNode, UniformNode } from 'three/webgpu'
import { createWindUniforms, windOffset, type WindSettings, type WindUniforms } from '../wind/wind'
import { trampleUv, type TrampleMap } from '../../trample/trample'
import type { GradingContext } from '../../grading/grading'
import { createDropShadowCatcher, stylizedOutput } from '../../grading/stylizedOutput'
import { HeightField } from '../../terrain/heightField'
import { sampleHeight } from '../../terrain/heightField'
import { ControlMap, controlUv } from '../../terrain/controlMap'
import { createScatterBake, MASK_EPSILON } from '../scatter/density'

const bladeWidth = uniform(0.1)
const bladeHeight = uniform(0.6)
const bladeHeightRandomness = uniform(0.6)
const shadowIntensity = uniform(0.5)

// unit blade in the XY plane: 2 bottom verts, 2 mid at half width, 1 tip → 3 triangles
const BLADE_POSITIONS = new Float32Array([
  -1, 0, 0, // bottom-left
  1, 0, 0, // bottom-right
  -0.5, 0.7, 0, // mid-left
  0.5, 0.7, 0, // mid-right
  0, 1, 0, // tip
])
// wind weight per level: base static, mid partial, tip full → blade curves instead of hinging
const BLADE_WIND_WEIGHT = new Float32Array([0, 0, 0.7, 0.7, 1])
const BLADE_INDICES = [0, 1, 2, 1, 3, 2, 2, 3, 4]

export interface GrassOptions extends WindSettings {
    subdivisions: number
    size: number
    colorA: TresColor
    colorB: TresColor
    diffuseMap?: Texture | null
    trample?: TrampleMap | null
    grading?: GradingContext | null
    heightField?: HeightField | null
    control?: ControlMap | null
    maskLow?: number
    maskHigh?: number
}

export function createGrassGeometry(options: GrassOptions) {
  const { subdivisions, size } = options
  const count = subdivisions * subdivisions
  const fragmentSize = size / subdivisions
  const anchors = new Float32Array(count * 2)
  const randoms = new Float32Array(count)
  const yaws = new Float32Array(count)
  // anchor-only noises baked at build time instead of per-vertex in the shader
  const heightNoises = new Float32Array(count)
  const colorNoises = new Float32Array(count)
  const noise = new ImprovedNoise()

  for (let iX = 0; iX < subdivisions; iX++) {
    for (let iZ = 0; iZ < subdivisions; iZ++) {
      const i = iX * subdivisions + iZ

      // cell center + jitter
      anchors[i * 2] = (iX + 0.5) / subdivisions * size - size / 2 + (Math.random() - 0.5) * fragmentSize
      anchors[i * 2 + 1] = (iZ + 0.5) / subdivisions * size - size / 2 + (Math.random() - 0.5) * fragmentSize
      randoms[i] = Math.random()
      yaws[i] = Math.random() * Math.PI * 2
      // perlin patchiness, remapped like the old shader noise: height [0.5, 1.5], color [0, 1]
      heightNoises[i] = noise.noise(anchors[i * 2] * 0.0321, anchors[i * 2 + 1] * 0.0321, 0) * 0.5 + 1
      colorNoises[i] = noise.noise(anchors[i * 2] * 0.02, anchors[i * 2 + 1] * 0.02, 0) * 0.5 + 0.5
    }
  }

  // Coverage here is the bare control mask: no patch noise, no jitter. Blades where
  // it collapses to nothing already get punted out of view in the vertex stage, so
  // sorting by mask and drawing only the live prefix removes them from the dispatch
  // without changing a pixel. Over half this field is road, water and off-band.
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
  })

  const geometry = new InstancedBufferGeometry()
  geometry.instanceCount = count
  geometry.setIndex(BLADE_INDICES)
  geometry.setAttribute('position', new BufferAttribute(BLADE_POSITIONS, 3))
  geometry.setAttribute('windWeight', new BufferAttribute(BLADE_WIND_WEIGHT, 1))
  // held so a mask-band change can re-upload them after a re-sort
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
  // real bounds (field half-diagonal + sway/height margin) so frustum culling can skip the draw
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
  diffuseMapNode?: TextureNode | null, 
  trample?: TrampleMap | null,
  grading?: GradingContext | null,
  heightField?: HeightField | null,
  control?: ControlMap | null,
  maskLow?: UniformNode<'float', number> | null,
  maskHigh?: UniformNode<'float', number> | null
}): MeshBasicNodeMaterial | MeshLambertNodeMaterial {
    const { colorAUniform, colorBUniform, windUniforms, diffuseMapNode, trample, grading, heightField, control, maskLow, maskHigh } = options
    // graded blades catch drop shadows — Lambert base only so the catcher runs
    const material = grading ? new MeshLambertNodeMaterial() : new MeshBasicNodeMaterial()
    material.side = DoubleSide
    const grassWindOffset = windOffset(windUniforms)

    const anchor = attribute<'vec2'>('anchor', 'vec2')
    const windWeight = attribute<'float'>('windWeight', 'float')

    // patchiness noises are anchor-only, baked into instanced attributes at build time
    const groundColor = mix(colorAUniform, colorBUniform, attribute<'float'>('colorNoise', 'float'))

    material.positionNode = Fn(() => {
        const random = attribute<'float'>('random', 'float')
        const yaw = attribute<'float'>('yaw', 'float')

        const worldXZ = anchor.toVar()

        const visible = control ? 
          texture(control.texture, controlUv(control.uniforms, worldXZ))
              .g.smoothstep(maskLow, maskHigh).toVar()
        : float(1).toVar()

        const trampleAmt = trample ? texture(trample.texture, trampleUv(trample.uniforms, anchor)).r.toVar() : null

        // height: per-blade random × perlin patchiness, crushed where trampled
        const heightVariation = attribute<'float'>('heightNoise', 'float')
        let height = bladeHeight
          .mul(mix(1, random, bladeHeightRandomness))
          .mul(heightVariation)
          .mul(heightVariation)
        if (trampleAmt) height = height.mul(trampleAmt.mul(0.75).oneMinus())

        // unit blade → world scale, spun around its own base by the per-blade yaw
        const local = vec3(
          positionGeometry.x.mul(bladeWidth).mul(visible),
          positionGeometry.y.mul(height),
          0,
        ).toVar()
        local.xz.assign(rotateUV(local.xz, yaw, vec2(0)))

        const pos = vec3(local.x.add(worldXZ.x), local.y, local.z.add(worldXZ.y)).toVar()
        if (heightField) pos.y.addAssign(sampleHeight(heightField, worldXZ))

        // wind: taller blades sway more, weight curves the blade along its length.
        // Trampled blades are pinned down, so damp their sway too
        let windVec = grassWindOffset(anchor).mul(height).mul(2)
        if (trampleAmt) windVec = windVec.mul(trampleAmt.oneMinus())
        windVec = windVec.toVar()
        pos.addAssign(vec3(windVec.x.mul(windWeight), 0, windVec.y.mul(windWeight)))
        // blades bend rather than stretch: drop by the arc approximation |w|²/2h,
        // clamped so extreme gusts don't flatten them; weight² so the tip drops most
        const droop = windVec.dot(windVec).div(height.mul(2)).min(height.mul(0.35))
        pos.y.subAssign(droop.mul(windWeight).mul(windWeight))

        // live interactor: blades part radially away from the character under them
        if (trample) {
          const toBlade = anchor.sub(trample.uniforms.interactor)
          const dist = toBlade.length().max(1e-3)
          const push = dist.div(trample.uniforms.interactorRadius).oneMinus().max(0)
          pos.addAssign(vec3(toBlade.x.div(dist), 0, toBlade.y.div(dist)).mul(push.mul(push)).mul(windWeight).mul(0.5))
          pos.y.subAssign(push.mul(push).mul(height).mul(0.3).mul(windWeight))
        }
        // Kept even though the bake already dropped the dead blades: the CPU reader
        // and the GPU sampler can disagree by a hair right at the cutoff, and this
        // catches the few that land on the wrong side of it.
        pos.y.addAssign(visible.lessThan(MASK_EPSILON).select(float(1000), float(0)))

        return pos
    })()

    // sampled at the anchor only → constant across the blade (flat color per blade)
    const base = varying(diffuseMapNode ? diffuseMapNode.rgb : groundColor)

    if (grading) {
        // blade normals after wind/trample bending are noisy — skip core shadows.
        // Root darkening routes through the finish's AO (tints toward shadowColor,
        // re-grades with the cycle) instead of the legacy gray multiply
        const rootAo = varying(windWeight).oneMinus().mul(shadowIntensity).oneMinus()
        const dropShadow = createDropShadowCatcher()
        material.receivedShadowNode = dropShadow.receivedShadowNode
        material.outputNode = stylizedOutput(base, grading, { hasCoreShadows: false, aoNode: rootAo, dropShadowNode: dropShadow.shadowFactor })
    }
    else {
        const ao = varying(windWeight).oneMinus().mul(shadowIntensity)
        material.colorNode = mix(base, base.mul(0.35), ao)  // 0.35 = shadow darkness, tune in leches
    }
    return material
}

export function createGrass(options: GrassOptions) {
    const { geometry, bake, rebake } = createGrassGeometry(options)
    const colorAUniform = uniform(new Color(options.colorA as ColorRepresentation))
    const colorBUniform = uniform(new Color(options.colorB as ColorRepresentation))
    const maskLow = uniform(options.maskLow ?? 0.25)
    const maskHigh = uniform(options.maskHigh ?? 0.6)
    const windUniforms = createWindUniforms(options)

    // anchor ∈ [-size/2, size/2] → normalized field UV [0, 1]
    const diffuseMapNode = options.diffuseMap
      ? texture(options.diffuseMap, attribute<'vec2'>('anchor', 'vec2').div(options.size).add(0.5))
      : null

    const material = buildGrassMaterial({
      colorAUniform,
      colorBUniform,
      windUniforms,
      diffuseMapNode,
      trample: options.trample,
      grading: options.grading,
      heightField: options.heightField,
      control: options.control,
      maskLow,
      maskHigh,
    })
    // the mask alone decides the draw count, and MASK_EPSILON is the same cutoff the
    // vertex stage punts at — so every blade dropped here was already invisible
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
