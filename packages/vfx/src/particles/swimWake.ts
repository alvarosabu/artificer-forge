import { BufferGeometry, Color, Float32BufferAttribute, InstancedInterleavedBuffer, InstancedMesh, Matrix4 } from 'three'
import type { Vector3 } from 'three'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import type { Node } from 'three/webgpu'
import {
  abs, attribute, cos, float, instancedDynamicBufferAttribute, mix, mx_noise_float, sin, step, uniform, varying, vec3, vec4,
} from 'three/tsl'

export interface SwimWakeOptions {
  /** Pool of trail segments. The oldest segment is reused when the pool is full. */
  count?: number
  /** Subdivisions along each segment. More steps give a rounder arc when the swimmer turns. */
  steps?: number
  shade?: (baseColor: Node<'color'>, normal: Node<'vec3'>) => Node<'vec4'>
}

// One strip per arm of the V. x runs along the segment (0 to 1), y across the line (-1 to 1), z picks the arm.
// The strip needs inner vertices: the shader turns the yaw along x, and only a vertex can follow that arc.
function createSegmentGeometry(steps: number) {
  const positions: number[] = []
  const indices: number[] = []
  for (const arm of [-1, 1]) {
    const base = positions.length / 3
    for (let i = 0; i <= steps; i++) positions.push(i / steps, -1, arm, i / steps, 1, arm)
    for (let i = 0; i < steps; i++) {
      const a = base + i * 2
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  return geometry
}

/**
 * A V-shaped foam wake behind a swimmer. Each segment stays where it was dropped and the
 * shader pushes its two arms outward with age, so the V opens behind the swimmer and bends with the path.
 */
export function createSwimWake({ count = 64, steps = 8, shade }: SwimWakeOptions = {}) {
  const uniforms = {
    now: uniform(0),
    lifetime: uniform(3.5),
    halfWidth: uniform(0.08),
    /** Outward speed of each arm. Against the swim speed, this sets the opening angle of the V. */
    spread: uniform(1.1),
    thickness: uniform(0.2),
    grow: uniform(0.8),
    breakup: uniform(1),
    noiseScale: uniform(2.2),
    color: uniform(new Color('#f6fcff')),
  }

  const startData = new Float32Array(count * 4) // x, y, z, time
  const endData = new Float32Array(count * 4) // x, y, z, time
  const pathData = new Float32Array(count * 4) // startYaw, endYaw, startDistance, endDistance
  for (let i = 0; i < count; i++) {
    startData[i * 4 + 3] = -1e6
    endData[i * 4 + 3] = -1e6
  }

  const startBuffer = new InstancedInterleavedBuffer(startData, 4)
  const endBuffer = new InstancedInterleavedBuffer(endData, 4)
  const pathBuffer = new InstancedInterleavedBuffer(pathData, 4)
  const start = instancedDynamicBufferAttribute<'vec4'>(startBuffer, 'vec4')
  const end = instancedDynamicBufferAttribute<'vec4'>(endBuffer, 'vec4')
  const path = instancedDynamicBufferAttribute<'vec4'>(pathBuffer, 'vec4')

  // The raw attribute, not positionLocal: in the fragment stage positionLocal holds the moved vertex.
  const corner = attribute<'vec3'>('position', 'vec3')
  const along = corner.x
  const across = corner.y
  const arm = corner.z

  const center = mix(start.xyz, end.xyz, along)
  const age = uniforms.now.sub(mix(start.w, end.w, along))
  const life = age.div(uniforms.lifetime)
  const yaw = mix(path.x, path.y, along)
  const distance = mix(path.z, path.w, along)

  const side = vec3(cos(yaw), 0, sin(yaw).negate())
  const armOffset = uniforms.halfWidth.add(uniforms.spread.mul(age)).mul(arm)
  const lineOffset = uniforms.thickness.mul(0.5).mul(life.clamp(0, 1).mul(uniforms.grow).add(1)).mul(across)

  const material = new MeshBasicNodeMaterial()
  material.positionNode = center.add(side.mul(armOffset.add(lineOffset)))

  const vLife = varying(life)
  const vAcross = varying(across)
  const noise = mx_noise_float(vec3(varying(distance).mul(uniforms.noiseScale), varying(arm).mul(5.3), 0))
  // Clean at birth, broken up with age, and below 0 for any noise at life = 1.
  const keep = float(1).sub(vLife.mul(vLife).mul(uniforms.breakup.add(1))).add(noise.mul(uniforms.breakup).mul(vLife))
  const alive = step(0, vLife).mul(step(vLife, 1))
  material.opacityNode = step(abs(vAcross), keep).mul(alive)
  material.alphaTest = 0.5

  if (shade) material.outputNode = shade(uniforms.color, vec3(0, 1, 0))
  else material.colorNode = vec4(uniforms.color, 1)

  const mesh = new InstancedMesh(createSegmentGeometry(steps),material, count)
  mesh.frustumCulled = false
  const identity = new Matrix4()
  for (let i = 0; i < count; i++) mesh.setMatrixAt(i, identity)
  mesh.instanceMatrix.needsUpdate = true

  let cursor = 0
  let active = false
  let anchorX = 0
  let anchorY = 0
  let anchorZ = 0
  let anchorTime = 0
  let anchorYaw = 0
  let anchorDistance = 0
  // Stretches from the anchor to the swimmer every frame until it is long enough to keep.
  let head = 0

  function writeHead(position: Vector3, yaw: number, length: number) {
    const offset = head * 4
    startData[offset] = anchorX
    startData[offset + 1] = anchorY
    startData[offset + 2] = anchorZ
    startData[offset + 3] = anchorTime
    endData[offset] = position.x
    endData[offset + 1] = position.y
    endData[offset + 2] = position.z
    endData[offset + 3] = uniforms.now.value
    // Unwrapped against the anchor, or a turn across ±π spins the segment the long way round.
    const turn = ((yaw - anchorYaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI
    pathData[offset] = anchorYaw
    pathData[offset + 1] = anchorYaw + turn
    pathData[offset + 2] = anchorDistance
    pathData[offset + 3] = anchorDistance + length
    startBuffer.needsUpdate = true
    endBuffer.needsUpdate = true
    pathBuffer.needsUpdate = true
  }

  function anchor(position: Vector3, yaw: number, distance: number) {
    anchorX = position.x
    anchorY = position.y
    anchorZ = position.z
    anchorTime = uniforms.now.value
    anchorYaw = yaw
    anchorDistance = distance
    head = cursor
    cursor = (cursor + 1) % count
  }

  /** Call every frame while swimming. `position` is on the water surface, `yaw` is the travel direction as in rotation.y. */
  function follow(position: Vector3, yaw: number, spacing = 0.3) {
    if (!active) {
      active = true
      anchor(position, yaw, Math.random() * 100)
    }
    const length = Math.hypot(position.x - anchorX, position.z - anchorZ)
    // A teleport or respawn would draw one long segment across the jump.
    if (length > spacing * 4) {
      stop()
      follow(position, yaw, spacing)
      return
    }
    writeHead(position, yaw, length)
    if (length >= spacing) anchor(position, yaw, anchorDistance + length)
  }

  /** Ends the current trail. The next follow() starts a new one, not joined to this one. */
  function stop() {
    active = false
  }

  function update(now: number) {
    uniforms.now.value = now
  }

  function dispose() {
    mesh.geometry.dispose()
    material.dispose()
  }

  return { mesh, uniforms, follow, stop, update, dispose }
}

export type SwimWake = ReturnType<typeof createSwimWake>
