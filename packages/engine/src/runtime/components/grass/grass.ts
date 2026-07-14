import { TresColor } from '@tresjs/core'
import { BufferAttribute, BufferGeometry, Color, DoubleSide, Sphere, Vector2, Vector3 } from 'three'
import { atan, attribute, PI, cameraPosition, Fn, mix, mx_noise_float, rotateUV, step, uniform, uniformArray, varying, vec3, vertexIndex } from 'three/tsl'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import type { ColorRepresentation, Node, UniformNode } from 'three/webgpu'

const bladeWidth = uniform(0.1)
const bladeHeight = uniform(0.6)
const bladeHeightRandomness = uniform(0.6)
// (x, y) pairs: tip, bottom-right, bottom-left
const bladeShape = uniformArray<'vec2'>([
  new Vector2(0, 1),
  new Vector2(1, 0),
  new Vector2(-1, 0),
], 'vec2')

export interface GrassOptions {
    subdivisions: number
    size: number
    colorA: TresColor
    colorB: TresColor
}

export function createGrassGeometry(options: GrassOptions) {
    const { subdivisions, size } = options
  const count = subdivisions * subdivisions
  const fragmentSize = size / subdivisions
  const positions = new Float32Array(count * 3 * 2)      // 3 verts × (x, z)
  const heightRandomness = new Float32Array(count * 3)

  for (let iX = 0; iX < subdivisions; iX++) {
    for (let iZ = 0; iZ < subdivisions; iZ++) {
      const i = iX * subdivisions + iZ
      const i6 = i * 6
      const i3 = i * 3

      // cell center + jitter, all 3 verts share the SAME anchor
      const x = (iX + 0.5) / subdivisions * size - size / 2 + (Math.random() - 0.5) * fragmentSize
      const z = (iZ + 0.5) / subdivisions * size - size / 2 + (Math.random() - 0.5) * fragmentSize

      positions[i6] = x;     positions[i6 + 1] = z
      positions[i6 + 2] = x; positions[i6 + 3] = z
      positions[i6 + 4] = x; positions[i6 + 5] = z

      heightRandomness[i3] = Math.random()
      heightRandomness[i3 + 1] = Math.random()
      heightRandomness[i3 + 2] = Math.random()
    }
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 2))   // itemSize 2!
  geometry.setAttribute('heightRandomness', new BufferAttribute(heightRandomness, 1))
  geometry.boundingSphere = new Sphere(new Vector3(), 1)                 // fake, required
  return geometry
}

export function buildGrassMaterial( options: { colorAUniform: UniformNode<'color', Color>, colorBUniform: UniformNode<'color', Color> } ): MeshBasicNodeMaterial {
    const material = new MeshBasicNodeMaterial()
    material.side = DoubleSide
    const { colorAUniform, colorBUniform } = options
    const groundColor = Fn(([worldXZ]: [Node<'vec2'>]) => {
        const variation = mx_noise_float(worldXZ.mul(0.02)).mul(0.5).add(0.5)   // remap [-1,1] → [0,1]
        return mix(colorAUniform, colorBUniform, variation)
      })
    material.positionNode = Fn(() => {
      const anchor = attribute<'vec2'>('position', 'vec2')            // xz, itemSize 2
      const vertexLoopIndex = varying(vertexIndex.toFloat().mod(3))   // 0 = tip, 1, 2
      const tipness = varying(step(vertexLoopIndex, 0.5))             // 1 on tip vert (used from M1 on)
      const template = bladeShape.element(vertexLoopIndex.toInt())
    
      // height: per-blade random × perlin patchiness
        // mx_noise_float ∈ ~[-1, 1] → remap to [0.5, 1.5] (source's texture read was [0,1].add(0.5))
        const heightRand = attribute<'float'>('heightRandomness', 'float')
        const heightVariation = mx_noise_float(anchor.mul(0.0321)).mul(0.5).add(1)
        const height = bladeHeight
        .mul(mix(1, heightRand, bladeHeightRandomness))   // bladeHeightRandomness = uniform(0.6)
        .mul(heightVariation)

        // shape, built at the anchor, .toVar() so we can mutate it below
        const pos = vec3(
        anchor.x.add(template.x.mul(bladeWidth)),
        template.y.mul(height),
        anchor.y,
        ).toVar()

        // billboard: rotate around the blade BASE (anchor), not origin
        const angle = atan(
        anchor.y.sub(cameraPosition.z),
        anchor.x.sub(cameraPosition.x),
        ).sub(PI.div(2))
        pos.xz.assign(rotateUV(pos.xz, angle, anchor))

        return pos
    })()
    const shadowIntensity = uniform(0.5)

    material.colorNode = Fn(() => {
        const vertexLoopIndex = varying(vertexIndex.toFloat().mod(3))   // 0 = tip, 1, 2
        const tipness = varying(step(vertexLoopIndex, 0.5)) 
        const worldXZUv = varying(attribute<'vec2'>('position', 'vec2'))
        const base = groundColor(worldXZUv)   // same worldXZ the vertex stage used, pass via varying
        const ao = tipness.oneMinus().mul(shadowIntensity)
        return mix(base, base.mul(0.35), ao)  // 0.35 = shadow darkness, tune in leches
    })()
    return material
}

export function createGrass(options: GrassOptions) {
    const geometry = createGrassGeometry(options)
    const colorAUniform = uniform(new Color(options.colorA as ColorRepresentation))
    const colorBUniform = uniform(new Color(options.colorB as ColorRepresentation))
    
    const material = buildGrassMaterial({ colorAUniform, colorBUniform })
    const uniforms = {
        bladeWidth,
        bladeHeight,
        bladeHeightRandomness,
        bladeShape,
        colorA: colorAUniform,
        colorB: colorBUniform,
    }
    return { geometry, material, uniforms, dispose: () => {
        geometry.dispose()
        material.dispose()
    } }
}