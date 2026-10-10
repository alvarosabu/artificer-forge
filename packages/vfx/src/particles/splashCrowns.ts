import { Color, CylinderGeometry, DoubleSide, InstancedInterleavedBuffer, InstancedMesh, Matrix4 } from 'three'
import type { Vector3 } from 'three'
import { MeshBasicNodeMaterial, type Node } from 'three/webgpu'
import { faceDirection, float, instancedDynamicBufferAttribute, normalLocal, positionLocal, sin, step, uniform, uv, vec3, vec4 } from 'three/tsl'

export interface SplashCrownsOptions {
  /** Pool size. The oldest crown is reused when the pool is full. */
  count?: number
  shade?: (baseColor: Node<'color'>, normal: Node<'vec3'>) => Node<'vec4'>

}

export function createSplashCrowns({ count = 6, shade }: SplashCrownsOptions = {}) {
  const uniforms = {
    now: uniform(0),
    color: uniform(new Color('#eaf8ff')),
    fade: uniform(2),
    flare: uniform(0.6),
    rimWidth: uniform(0.1),
  }

  const spawnData = new Float32Array(count * 4) // x, y, z, spawnTime
  const shapeData = new Float32Array(count * 4) // radius, height, lifetime, seed
  for (let i = 0; i < count; i++) spawnData[i * 4 + 3] = -1e6

  const spawnBuffer = new InstancedInterleavedBuffer(spawnData, 4)
  const shapeBuffer = new InstancedInterleavedBuffer(shapeData, 4)
  const spawn = instancedDynamicBufferAttribute<'vec4'>(spawnBuffer, 'vec4')
  const shape = instancedDynamicBufferAttribute<'vec4'>(shapeBuffer, 'vec4')

  const life = uniforms.now.sub(spawn.w).div(shape.z)
  const alive = step(0, life).mul(step(life, 1))
  const t = life.clamp(0, 1)
  
  const height = shape.y.mul(t.mul(t.oneMinus()).mul(4))
  const spread = t.oneMinus().pow(2).oneMinus().mul(0.6).add(0.6)
  
  const ring = shape.x.mul(spread).mul(uv().y.mul(uniforms.flare).add(1))
  const local = vec3(positionLocal.x.mul(ring), positionLocal.y.mul(height), positionLocal.z.mul(ring))

  const material = new MeshBasicNodeMaterial({ side: DoubleSide, transparent: true, depthWrite: false })
  material.positionNode = spawn.xyz.add(local).mul(alive)

  const around = uv().x.mul(Math.PI * 2)
  const seed = shape.w
  const fingers = sin(around.mul(9).add(seed.mul(40))).mul(0.6)
    .add(sin(around.mul(5).add(seed.mul(17))).mul(0.4))
    .mul(0.5).add(0.5)
  const cut = float(1).sub(t.mul(0.5).add(0.25).mul(fingers))
  material.maskNode = uv().y.lessThan(cut)

  const toEdge = uv().y.div(cut)
  const alpha = toEdge.pow(uniforms.fade).max(step(cut.sub(uniforms.rimWidth), uv().y))
  const normal = normalLocal.mul(faceDirection)
  const lit = shade ? shade(uniforms.color, normal).rgb : uniforms.color.mul(normal.y.mul(0.3).add(0.8))
  material.outputNode = vec4(lit, alpha)

  const geometry = new CylinderGeometry(1, 1, 1, 32, 1, true).translate(0, 0.5, 0)
  const mesh = new InstancedMesh(geometry, material, count)
  mesh.frustumCulled = false
  mesh.renderOrder = 1
  const identity = new Matrix4()
  for (let i = 0; i < count; i++) mesh.setMatrixAt(i, identity)
  mesh.instanceMatrix.needsUpdate = true

  let cursor = 0

  function emit(position: Vector3, radius: number, height: number, gravity: number) {
    const offset = cursor * 4
    spawnData[offset] = position.x
    spawnData[offset + 1] = position.y
    spawnData[offset + 2] = position.z
    spawnData[offset + 3] = uniforms.now.value
    shapeData[offset] = radius
    shapeData[offset + 1] = height
    shapeData[offset + 2] = 2 * Math.sqrt((2 * height) / gravity)
    shapeData[offset + 3] = Math.random()
    cursor = (cursor + 1) % count
    spawnBuffer.needsUpdate = true
    shapeBuffer.needsUpdate = true
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

export type SplashCrowns = ReturnType<typeof createSplashCrowns>