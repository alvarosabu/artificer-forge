import { Color, InstancedInterleavedBuffer, InstancedMesh, Matrix4, PlaneGeometry } from 'three'
import type { Vector3 } from 'three'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import type { Node } from 'three/webgpu'
import { abs, float, instancedDynamicBufferAttribute, positionLocal, pow, step, uniform, uv, vec3, vec4 } from 'three/tsl'

export interface SplashRipplesOptions {
  /** Pool size. The oldest ripple is reused when the pool is full. */
  count?: number
  shade?: (baseColor: Node<'color'>, normal: Node<'vec3'>) => Node<'vec4'>
}

export function createSplashRipples({ count = 24, shade }: SplashRipplesOptions = {}) {
  const uniforms = {
    now: uniform(0),
    lifetime: uniform(1.1),
    /** Band width at birth, as a fraction of the final radius. */
    width: uniform(0.18),
    /** Higher values grow fast and then crawl. */
    easePower: uniform(3),
    color: uniform(new Color('#f6fcff')),
  }

  const spawnData = new Float32Array(count * 4) // x, y, z, spawnTime
  const radiusData = new Float32Array(count)
  for (let i = 0; i < count; i++) spawnData[i * 4 + 3] = -1e6

  const spawnBuffer = new InstancedInterleavedBuffer(spawnData, 4)
  const radiusBuffer = new InstancedInterleavedBuffer(radiusData, 1)
  const spawn = instancedDynamicBufferAttribute<'vec4'>(spawnBuffer, 'vec4')
  const maxRadius = instancedDynamicBufferAttribute<'float'>(radiusBuffer, 'float')

  const life = uniforms.now.sub(spawn.w).div(uniforms.lifetime)
  const alive = step(0, life).mul(step(life, 1))
  const t = life.clamp(0, 1)

  const material = new MeshBasicNodeMaterial()

  material.positionNode = spawn.xyz.add(positionLocal.mul(maxRadius.mul(2)).mul(alive))

  const distance = uv().sub(0.5).length().mul(2)
  const radius = float(1).sub(pow(t.oneMinus(), uniforms.easePower))
  const halfWidth = uniforms.width.mul(t.oneMinus()).mul(0.5)

material.opacityNode =  step(abs(distance.sub(radius)), halfWidth)
material.alphaTest= 0.5

if (shade) material.outputNode = shade(uniforms.color, vec3(0, 1, 0))
    else material.colorNode = vec4(uniforms.color, 1)

const geometry = new PlaneGeometry(1, 1).rotateX(-Math.PI * 0.5)
const mesh = new InstancedMesh(geometry, material, count)
mesh.frustumCulled = false
const identity = new Matrix4()
for (let i = 0; i < count; i++) mesh.setMatrixAt(i, identity)
mesh.instanceMatrix.needsUpdate = true

let cursor = 0

 /** A positive delay starts the ripple later, which is how a burst gets a second ring. */
 function emit(position: Vector3, radius: number, delay = 0) {
    const offset = cursor * 4
    spawnData[offset] = position.x
    spawnData[offset + 1] = position.y
    spawnData[offset + 2] = position.z
    spawnData[offset + 3] = uniforms.now.value + delay
    radiusData[cursor] = radius
    cursor = (cursor + 1) % count
    spawnBuffer.needsUpdate = true
    radiusBuffer.needsUpdate = true
  }

  function update(now: number) {
    uniforms.now.value = now
  }

  function dispose() {
    mesh.geometry.dispose()
    material.dispose()
  }

  return { mesh, uniforms, emit, update, dispose }
}

export type SplashRipples = ReturnType<typeof createSplashRipples>