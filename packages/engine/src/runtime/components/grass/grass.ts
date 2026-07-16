import { TresColor } from '@tresjs/core'
import { BufferAttribute, Color, DoubleSide, InstancedBufferAttribute, InstancedBufferGeometry, Sphere, Texture, Vector3 } from 'three'
import { attribute, Fn, mix, positionGeometry, rotateUV, texture, uniform, varying, vec2, vec3 } from 'three/tsl'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import { ImprovedNoise } from 'three/examples/jsm/math/ImprovedNoise.js'
import type { ColorRepresentation, TextureNode, UniformNode } from 'three/webgpu'
import { createWindUniforms, windOffset, type WindSettings, type WindUniforms } from '../wind/wind'
import { trampleUv, type TrampleMap } from '../../trample/trample'

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

  const geometry = new InstancedBufferGeometry()
  geometry.instanceCount = count
  geometry.setIndex(BLADE_INDICES)
  geometry.setAttribute('position', new BufferAttribute(BLADE_POSITIONS, 3))
  geometry.setAttribute('windWeight', new BufferAttribute(BLADE_WIND_WEIGHT, 1))
  geometry.setAttribute('anchor', new InstancedBufferAttribute(anchors, 2))
  geometry.setAttribute('random', new InstancedBufferAttribute(randoms, 1))
  geometry.setAttribute('yaw', new InstancedBufferAttribute(yaws, 1))
  geometry.setAttribute('heightNoise', new InstancedBufferAttribute(heightNoises, 1))
  geometry.setAttribute('colorNoise', new InstancedBufferAttribute(colorNoises, 1))
  // real bounds (field half-diagonal + sway/height margin) so frustum culling can skip the draw
  geometry.boundingSphere = new Sphere(new Vector3(), (size / 2) * Math.SQRT2 + 2)
  return geometry
}

export function buildGrassMaterial(options: { colorAUniform: UniformNode<'color', Color>, colorBUniform: UniformNode<'color', Color>, windUniforms: WindUniforms, diffuseMapNode?: TextureNode | null, trample?: TrampleMap | null }): MeshBasicNodeMaterial {
    const material = new MeshBasicNodeMaterial()
    material.side = DoubleSide
    const { colorAUniform, colorBUniform, windUniforms, diffuseMapNode, trample } = options
    const grassWindOffset = windOffset(windUniforms)

    const anchor = attribute<'vec2'>('anchor', 'vec2')
    const windWeight = attribute<'float'>('windWeight', 'float')

    // patchiness noises are anchor-only, baked into instanced attributes at build time
    const groundColor = mix(colorAUniform, colorBUniform, attribute<'float'>('colorNoise', 'float'))

    material.positionNode = Fn(() => {
        const random = attribute<'float'>('random', 'float')
        const yaw = attribute<'float'>('yaw', 'float')

        const trampleAmt = trample ? texture(trample.texture, trampleUv(trample.uniforms, anchor)).r.toVar() : null

        // height: per-blade random × perlin patchiness, crushed where trampled
        const heightVariation = attribute<'float'>('heightNoise', 'float')
        let height = bladeHeight
          .mul(mix(1, random, bladeHeightRandomness))
          .mul(heightVariation)
        if (trampleAmt) height = height.mul(trampleAmt.mul(0.75).oneMinus())

        // unit blade → world scale, spun around its own base by the per-blade yaw
        const local = vec3(
          positionGeometry.x.mul(bladeWidth),
          positionGeometry.y.mul(height),
          0,
        ).toVar()
        local.xz.assign(rotateUV(local.xz, yaw, vec2(0)))

        const pos = vec3(local.x.add(anchor.x), local.y, local.z.add(anchor.y)).toVar()

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

        return pos
    })()

    material.colorNode = Fn(() => {
        // sampled at the anchor only → constant across the blade (flat color per blade)
        const base = varying(diffuseMapNode ?? groundColor)
        const ao = varying(windWeight).oneMinus().mul(shadowIntensity)
        return mix(base, base.mul(0.35), ao)  // 0.35 = shadow darkness, tune in leches
    })()
    return material
}

export function createGrass(options: GrassOptions) {
    const geometry = createGrassGeometry(options)
    const colorAUniform = uniform(new Color(options.colorA as ColorRepresentation))
    const colorBUniform = uniform(new Color(options.colorB as ColorRepresentation))
    const windUniforms = createWindUniforms(options)

    // anchor ∈ [-size/2, size/2] → normalized field UV [0, 1]
    const diffuseMapNode = options.diffuseMap
      ? texture(options.diffuseMap, attribute<'vec2'>('anchor', 'vec2').div(options.size).add(0.5))
      : null

    const material = buildGrassMaterial({ colorAUniform, colorBUniform, windUniforms, diffuseMapNode, trample: options.trample })
    const uniforms = {
        bladeWidth,
        bladeHeight,
        bladeHeightRandomness,
        shadowIntensity,
        colorA: colorAUniform,
        colorB: colorBUniform,
        diffuseMap: diffuseMapNode,
        wind: windUniforms,
    }
    return { geometry, material, uniforms, dispose: () => {
        geometry.dispose()
        material.dispose()
    } }
}
