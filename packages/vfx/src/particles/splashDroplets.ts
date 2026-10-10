import { Color, IcosahedronGeometry, InstancedInterleavedBuffer, InstancedMesh, Matrix4 } from 'three'
import type { Vector3 } from 'three'
import { MeshBasicNodeMaterial, type Node } from 'three/webgpu'
import { float, instancedDynamicBufferAttribute, normalLocal, positionLocal, step, uniform, vec3, vec4 } from 'three/tsl'

export interface SplashDropletsOptions {
  /** Pool size. The oldest droplet is reused when the pool is full. */
  count?: number
  shade?: (baseColor: Node<'color'>, normal: Node<'vec3'>) => Node<'vec4'>
}

export function createSplashDroplets({ count = 96, shade }: SplashDropletsOptions = {}) {
  const uniforms = {
    now: uniform(0),
    gravity: uniform(14),
    lifetime: uniform(1.5),
    color: uniform(new Color('#e8f8ff')),
    length: uniform(6),
    stretch: uniform(0.15),
  }

  const spawnData = new Float32Array(count * 4) // x, y, z, spawnTime
  const motionData = new Float32Array(count * 4) // vx, vy, vz, size
  for (let i = 0; i < count; i++) spawnData[i * 4 + 3] = -1e6

  const spawnBuffer = new InstancedInterleavedBuffer(spawnData, 4)
  const motionBuffer = new InstancedInterleavedBuffer(motionData, 4)
  const spawn = instancedDynamicBufferAttribute<'vec4'>(spawnBuffer, 'vec4')
  const motion = instancedDynamicBufferAttribute<'vec4'>(motionBuffer, 'vec4')

  const age = uniforms.now.sub(spawn.w)
  const fall = vec3(0, uniforms.gravity.negate(), 0)
  const center = spawn.xyz.add(motion.xyz.mul(age)).add(fall.mul(age.mul(age).mul(0.5)))
  const alive = step(0, age).mul(step(age, uniforms.lifetime)).mul(step(spawn.y, center.y))
  const velocity = motion.xyz.add(fall.mul(age))
  const speed = velocity.length()
  const along = velocity.div(speed.max(1e-4))
  const stretch = speed.mul(uniforms.stretch).add(uniforms.length)

  // Thinner as it gets longer, so a streak keeps about the volume of the round droplet.
  const local = positionLocal.add(along.mul(positionLocal.dot(along)).mul(stretch.sub(1))).mul(stretch.inverseSqrt())
  const normal = normalLocal.add(along.mul(normalLocal.dot(along)).mul(float(1).div(stretch).sub(1))).normalize()

  const material = new MeshBasicNodeMaterial()
  material.positionNode = center.add(local.mul(motion.w).mul(alive))

  if (shade) {
    material.outputNode = shade(uniforms.color, normal)
  }
  else {
    const light = normal.dot(vec3(0.4, 0.8, 0.3).normalize()).mul(0.5).add(0.5)
    material.colorNode = vec4(uniforms.color.mul(light), 1)
  }

  const mesh = new InstancedMesh(new IcosahedronGeometry(0.5, 1), material, count)
  mesh.frustumCulled = false
  const identity = new Matrix4()
  for (let i = 0; i < count; i++) mesh.setMatrixAt(i, identity)
  mesh.instanceMatrix.needsUpdate = true

  let cursor = 0

  function emit(position: Vector3, velocity: Vector3, size: number) {
    const offset = cursor * 4
    spawnData[offset] = position.x
    spawnData[offset + 1] = position.y
    spawnData[offset + 2] = position.z
    spawnData[offset + 3] = uniforms.now.value
    motionData[offset] = velocity.x
    motionData[offset + 1] = velocity.y
    motionData[offset + 2] = velocity.z
    motionData[offset + 3] = size
    cursor = (cursor + 1) % count
    spawnBuffer.needsUpdate = true
    motionBuffer.needsUpdate = true
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

export type SplashDroplets = ReturnType<typeof createSplashDroplets>