import { BufferGeometry, Color, Float32BufferAttribute, IcosahedronGeometry, InstancedInterleavedBuffer, InstancedMesh, Matrix4 } from 'three'
import type { Vector2, Vector3 } from 'three'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import type { Node } from 'three/webgpu'
import {
  exp, float, fract, instancedDynamicBufferAttribute, max, normalLocal, positionLocal,
  rotate, smoothstep, step, uniform, vec3, vec4,
} from 'three/tsl'

export interface DustTrailOptions {
  /** Pool size. The oldest dust puff is reused when the pool is full. */
  count?: number
  /**
   * Turns the base color and the world normal into the final color. Pass the scene's
   * lighting here (e.g. the Engine's stylizedOutput) so the dust shades like the world.
   * Without it, a fixed half-Lambert light is used.
   */
  shade?: (baseColor: Node<'color'>, normal: Node<'vec3'>, alpha: Node<'float'>) => Node<'vec4'>
}

export interface DustEmitOptions {
  /** Horizontal start velocity (x, z) in units per second. Drag slows it down. */
  velocity?: Vector2
  /** Full-grown diameter in units. */
  size?: number
}

// Lobes of one dust puff: [x, y, z, radius], inside a unit sphere. Separate spheres,
// not one noisy sphere, give each bump its own clean normal, so the cel ramp draws
// the cauliflower outline without any normal maps.
const LOBES: [number, number, number, number][] = [
  [0, 0, 0, 0.5],
  [0.34, 0.06, 0.12, 0.34],
  [-0.3, 0.1, -0.14, 0.36],
  [0.06, 0.32, -0.04, 0.3],
  [0.08, -0.04, 0.36, 0.3],
  [-0.12, -0.06, -0.38, 0.28],
]

function createPuffGeometry() {
  const positions: number[] = []
  const normals: number[] = []
  for (const [x, y, z, radius] of LOBES) {
    // Detail 1 (80 faces) is round enough once the lobe is under 20 px on screen.
    const lobe = new IcosahedronGeometry(radius, 1)
    const p = lobe.getAttribute('position')
    const n = lobe.getAttribute('normal')
    for (let i = 0; i < p.count; i++) {
      positions.push(p.getX(i) + x, p.getY(i) + y, p.getZ(i) + z)
      normals.push(n.getX(i), n.getY(i), n.getZ(i))
    }
    lobe.dispose()
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3))
  return geometry
}

/**
 * Pooled dust puffs driven by a ring buffer.
 *
 * The CPU writes one slot per emit (spawn point, spawn time, velocity, size) and never
 * touches a dust puff again. The vertex shader derives everything else from its age:
 * a quick pop to full size, drift, rise and a shrink to nothing. No transparency, so
 * there is no sorting and the puffs read as solid, like Mario Odyssey's run dust.
 *
 * Usage:
 *   const dust = createDustTrail({ shade })
 *   onBeforeRender(({ elapsed }) => dust.update(elapsed))
 *   dust.emit(position, { velocity, size })
 *   // In template: <primitive :object="dust.mesh" />, in world space, not under a moving parent
 */
export function createDustTrail({ count = 64, shade }: DustTrailOptions = {}) {
  // The CPU stamps spawn times and the GPU reads ages, so both must use this one clock.
  // The TSL `time` node runs on the renderer's own frame clock, which the CPU cannot read.
  const uniforms = {
    now: uniform(0),
    lifetime: uniform(0.7),
    rise: uniform(0.15),
    drag: uniform(4),
    color: uniform(new Color('#f7f3ec')),
    // Change it with setOpacity(), which also flips the material's blending mode.
    opacity: uniform(1),
  }

  // Two vec4 slots per dust puff instead of one attribute per value: WebGPU allows 8 vertex
  // buffers per pipeline, and position, normal and instanceMatrix already use 3.
  const spawnData = new Float32Array(count * 4) // x, y, z, spawnTime
  const motionData = new Float32Array(count * 4) // vx, vz, size, seed
  // Start every slot long dead, so nothing draws before the first emit.
  for (let i = 0; i < count; i++) spawnData[i * 4 + 3] = -1e6

  // Pass our own buffers, not BufferAttributes: TSL wraps a BufferAttribute's array in a
  // new buffer of its own, so needsUpdate on the attribute would never reach the GPU.
  // It must be the Instanced kind: WebGPU reads the per-instance step mode from the
  // buffer, not from the instanced flag TSL sets on the attribute.
  const spawnBuffer = new InstancedInterleavedBuffer(spawnData, 4)
  const motionBuffer = new InstancedInterleavedBuffer(motionData, 4)
  const spawn = instancedDynamicBufferAttribute<'vec4'>(spawnBuffer, 'vec4')
  const motion = instancedDynamicBufferAttribute<'vec4'>(motionBuffer, 'vec4')
  const seed = motion.w

  const age = uniforms.now.sub(spawn.w)
  const life = age.div(uniforms.lifetime)
  // 1 while 0 <= life < 1. Past the end, the scale goes to 0 and the puff draws nothing.
  const alive = step(0, life).mul(step(life, 1))
  const t = life.clamp(0, 1)

  // Pop in over the first 15% of life, hold, then shrink to nothing. Shrinking instead of
  // fading is what makes the dust read as a solid cartoon cloud rather than smoke.
  const scale = smoothstep(0, 0.15, t).mul(smoothstep(1, 0.35, t))
  const size = motion.z.mul(scale).mul(alive)

  // Integral of v * e^(-drag * age): the puff slides out and settles instead of moving forever.
  const slide = float(1).sub(exp(uniforms.drag.negate().mul(age))).div(max(uniforms.drag, 1e-3))
  const center = vec3(
    spawn.x.add(motion.x.mul(slide)),
    spawn.y.add(uniforms.rise.mul(t)),
    spawn.z.add(motion.y.mul(slide)),
  )

  // A random turn per puff: one shared geometry, but no two dust puffs look the same.
  const turn = vec3(
    fract(seed.mul(7.13)).sub(0.5).mul(1.2),
    seed.mul(Math.PI * 2),
    fract(seed.mul(13.7)).sub(0.5).mul(1.2),
  )

  const material = new MeshBasicNodeMaterial()
  // positionLocal here is still the raw lobe vertex: instancedMesh() applies the identity
  // instance matrix before positionNode runs.
  material.positionNode = center.add(rotate(positionLocal, turn).mul(size))
  // The instance matrix is identity and the mesh sits at the origin, so the turned local
  // normal is already the world normal.
  const normal = rotate(normalLocal, turn).normalize()

  if (shade) {
    material.outputNode = shade(uniforms.color, normal, uniforms.opacity)
  }
  else {
    const light = normal.dot(vec3(0.4, 0.8, 0.3).normalize()).mul(0.5).add(0.5)
    material.colorNode = vec4(uniforms.color.mul(light), 1)
    material.opacityNode = uniforms.opacity
  }

  const mesh = new InstancedMesh(createPuffGeometry(), material, count)
  // Every puff sits at the origin until the shader moves it, so the default bounds are wrong.
  mesh.frustumCulled = false
  // The shadow pass runs the same positionNode, so the drop shadows follow the puffs.
  mesh.castShadow = true
  const identity = new Matrix4()
  for (let i = 0; i < count; i++) mesh.setMatrixAt(i, identity)
  mesh.instanceMatrix.needsUpdate = true

  let cursor = 0

  function emit(position: Vector3, { velocity, size = 0.4 }: DustEmitOptions = {}) {
    const offset = cursor * 4
    spawnData[offset] = position.x
    spawnData[offset + 1] = position.y
    spawnData[offset + 2] = position.z
    spawnData[offset + 3] = uniforms.now.value
    motionData[offset] = velocity?.x ?? 0
    motionData[offset + 1] = velocity?.y ?? 0
    motionData[offset + 2] = size
    motionData[offset + 3] = Math.random()
    cursor = (cursor + 1) % count
    // Full re-upload: the whole pool is about 2 KB, so tracking dirty ranges is not worth it.
    spawnBuffer.needsUpdate = true
    motionBuffer.needsUpdate = true
  }

  /** Call once per frame, before any emit in that frame, with the loop's elapsed seconds. */
  function update(now: number) {
    uniforms.now.value = now
  }

  /**
   * Below 1 the material blends. The puffs are not sorted, so overlapping lobes can
   * show through each other. At 1 it goes back to opaque, which has no such artifact.
   */
  function setOpacity(value: number) {
    uniforms.opacity.value = value
    const transparent = value < 1
    if (material.transparent === transparent) return
    material.transparent = transparent
    // Blending is pipeline state, not a uniform, so the pipeline must rebuild.
    material.needsUpdate = true
  }

  function dispose() {
    mesh.geometry.dispose()
    material.dispose()
  }

  return { mesh, uniforms, emit, update, setOpacity, dispose }
}

export type DustTrail = ReturnType<typeof createDustTrail>
