import { AdditiveBlending, DoubleSide, InstancedMesh, Matrix4, PlaneGeometry } from 'three'
import { MeshStandardNodeMaterial } from 'three/webgpu'
import {
  color, cos, float, fract, hash, instanceIndex, mix, mul,
  positionLocal, sin, smoothstep,
  texture as textureNode, time, uv, vec2, vec3,
} from 'three/tsl'
import type { DataTexture } from 'three'

/**
 * GPU-driven ember/spark system for fire surfaces.
 *
 * Returns an InstancedMesh of small quads whose animation is entirely in the
 * vertex shader via TSL — zero CPU updates per frame. Each instance gets a
 * unique random stream from `instanceIndex + hash`, rising and drifting over
 * a timed lifecycle. Embers are suppressed above cells with no fire by
 * sampling the fire DataTexture.
 *
 * Usage:
 *   const { mesh } = createInstancedEmberSystem(WIDTH, DEPTH, fireTexture)
 *   // In template: <TresPrimitive :object="mesh" />
 *   // fireTexture must be kept up to date (packFire + needsUpdate each frame)
 */
export function createInstancedEmberSystem(
  width: number,
  depth: number,
  fireTex: DataTexture,
  count = 200,
): { mesh: InstancedMesh } {
  const geo = new PlaneGeometry(0.06, 0.06)
  const mat = new MeshStandardNodeMaterial()
  mat.transparent = true
  mat.depthWrite = false
  mat.blending = AdditiveBlending
  mat.side = DoubleSide

  const i = instanceIndex.toFloat()

  // Per-instance random streams — offset seeds give independent distributions
  const randX     = hash(i).mul(float(width)).sub(float(width / 2))
  const randZ     = hash(i.add(float(17))).mul(float(depth)).sub(float(depth / 2))
  const randSpeed = hash(i.add(float(31))).mul(float(0.8)).add(float(0.4)) // 0.4..1.2
  const randPhase = hash(i.add(float(53))).mul(float(Math.PI * 2))

  // Lifecycle loops 0→1 per ember on its own time offset
  const lifeCycle = fract(time.mul(randSpeed).add(randPhase))

  const riseY  = lifeCycle.mul(float(2.5))
  const driftX = sin(randPhase.add(time.mul(float(0.7)))).mul(float(0.15))
  const driftZ = cos(randPhase.add(time.mul(float(0.9)))).mul(float(0.12))

  // Fade in quickly, sustain through mid-life, fade out before loop reset
  const alpha = smoothstep(float(0.0), float(0.15), lifeCycle)
    .mul(smoothstep(float(1.0), float(0.6), lifeCycle))

  // Sample fire coverage — embers only appear above active fire cells
  const halfW = float(width / 2)
  const halfD = float(depth / 2)
  const fireU = randX.add(driftX).add(halfW).div(float(width))
  // V-flip matches the grid-to-texture orientation used by packFire
  const fireV = float(1).sub(randZ.add(driftZ).add(halfD).div(float(depth)))
  const firePresence = textureNode(fireTex, vec2(fireU, fireV)).r

  // positionNode adds the per-instance world offset to each quad vertex.
  // Instance matrices are initialised to identity below, so positionLocal
  // here is the raw geometry vertex (±0.03 quad corners).
  mat.positionNode = positionLocal.add(
    vec3(randX.add(driftX), riseY, randZ.add(driftZ)),
  )
  mat.opacityNode = alpha.mul(firePresence)

  // Soft circle: white-hot core → orange rim
  const centeredUv = uv().sub(vec2(float(0.5), float(0.5)))
  const dist = centeredUv.length()
  const circle = smoothstep(float(0.5), float(0.1), dist)
  const emberColor = mix(color('#ff6600'), color('#fffacc'), circle)

  mat.colorNode = emberColor
  mat.emissiveNode = mul(emberColor, float(2.5))

  const mesh = new InstancedMesh(geo, mat, count)
  mesh.frustumCulled = false

  // Identity matrices: positionNode drives placement, instance transform is a no-op
  const identity = new Matrix4()
  for (let j = 0; j < count; j++) {
    mesh.setMatrixAt(j, identity)
  }
  mesh.instanceMatrix.needsUpdate = true

  return { mesh }
}
