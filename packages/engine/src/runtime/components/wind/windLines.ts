import { TresColor } from '@tresjs/core'
import { BufferAttribute, BufferGeometry, CatmullRomCurve3, Color, Mesh, Vector3 } from 'three'
import { attribute, cameraProjectionMatrix, cameraViewMatrix, float, Fn, modelWorldMatrix, positionGeometry, uniform, vec3, vec4, vertexIndex } from 'three/tsl'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import type { ColorRepresentation, UniformNode } from 'three/webgpu'

export function remapClamp(v: number, inLo: number, inHi: number, outLo: number, outHi: number) {
  const t = Math.min(1, Math.max(0, (v - inLo) / (inHi - inLo)))
  return outLo + t * (outHi - outLo)
}

export interface WindLineGeometryOptions {
  length?: number
  handlesCount?: number
  amplitude?: number
  divisions?: number
}

// alternating up/down control points along Z → gentle vertical S-wave
export function windLineHandles(length: number, handlesCount: number, amplitude: number) {
  const handleSpan = length / (handlesCount - 1)
  return Array.from({ length: handlesCount }, (_, i) =>
    new Vector3(0, ((i % 2) - 0.5) * amplitude, -length / 2 + i * handleSpan))
}

// ribbon buffers: every curve point twice, the vertex shader pushes the copies
// to opposite sides. Vertex parity (even/odd) is the side selector.
export function createWindLineGeometry(options: WindLineGeometryOptions = {}) {
  const { length = 10, handlesCount = 4, amplitude = 1, divisions = 30 } = options
  const points = new CatmullRomCurve3(windLineHandles(length, handlesCount, amplitude)).getPoints(divisions)
  const count = points.length

  const positions = new Float32Array(count * 6)
  const ratios = new Float32Array(count * 2)
  const indices = new Uint16Array((count - 1) * 6)

  for (let i = 0; i < count; i++) {
    const p = points[i]
    const i2 = i * 2
    const i6 = i * 6
    positions.set([p.x, p.y, p.z, p.x, p.y, p.z], i6)
    ratios[i2] = ratios[i2 + 1] = i / (count - 1)
    if (i < count - 1) indices.set([i2 + 2, i2, i2 + 1, i2 + 1, i2 + 3, i2 + 2], i6)
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('ratio', new BufferAttribute(ratios, 1))
  geometry.setIndex(new BufferAttribute(indices, 1))
  return geometry
}

// constant world-space extrusion tangent (diagonal up/back). Works for the
// game's constrained camera; a free-orbit camera needs a screen-space offset.
const RIBBON_TANGENT = vec3(0, 1, -1).normalize()

export function createWindLineMaterial(options: { colorUniform: UniformNode<'color', Color>, thicknessUniform: UniformNode<'float', number> }) {
  const progress = uniform(0)
  const material = new MeshBasicNodeMaterial()
  material.transparent = true
  material.colorNode = options.colorUniform

  material.vertexNode = Fn(() => {
    const worldPosition = modelWorldMatrix.mul(vec4(positionGeometry, 1)).toVar()
    const ratio = attribute<'float'>('ratio', 'float')

    // taper: full thickness mid-line, zero at both ends
    const baseThickness = ratio.sub(0.5).abs().mul(2).oneMinus().smoothstep(0, 1)
    // traveling window: progress remapped to -1..2 so the ±1-wide window fully
    // enters and exits the 0..1 ratio range (change width → re-derive remap)
    const remappedProgress = progress.mul(3).sub(1)
    const progressThickness = ratio.sub(remappedProgress).abs().oneMinus().smoothstep(0, 1)
    const finalThickness = options.thicknessUniform.mul(baseThickness).mul(progressThickness)

    // vertex parity picks the side: even → +0.5, odd → -0.5
    const side = float(0.5).sub(vertexIndex.toFloat().mod(2))
    worldPosition.addAssign(vec4(RIBBON_TANGENT.mul(side.mul(finalThickness)), 0))

    return cameraProjectionMatrix.mul(cameraViewMatrix.mul(worldPosition))
  })()

  return { material, progress }
}

export interface WindLinesOptions extends WindLineGeometryOptions {
  count?: number
  color?: TresColor
  thickness?: number
}

export interface WindLineInstance {
  mesh: Mesh
  progress: UniformNode<'float', number>
  elapsed: number
  duration: number
  startX: number
  startZ: number
  angle: number
  active: boolean
}

export function createWindLines(options: WindLinesOptions = {}) {
  const { count = 4, color = '#ffffff', thickness = 0.1 } = options
  const geometry = createWindLineGeometry(options)
  const colorUniform = uniform(new Color(color as ColorRepresentation))
  const thicknessUniform = uniform(thickness)

  const lines: WindLineInstance[] = Array.from({ length: count }, () => {
    const { material, progress } = createWindLineMaterial({ colorUniform, thicknessUniform })
    const mesh = new Mesh(geometry, material)
    mesh.visible = false
    mesh.renderOrder = 1 // draw after opaques; alpha stays 1, thickness does the fading
    return { mesh, progress, elapsed: 0, duration: 0, startX: 0, startZ: 0, angle: 0, active: false }
  })

  return {
    lines,
    uniforms: { color: colorUniform, thickness: thicknessUniform },
    dispose: () => {
      geometry.dispose()
      for (const line of lines) (line.mesh.material as MeshBasicNodeMaterial).dispose()
    },
  }
}

export interface WindLineSpawnContext {
  originX: number
  originZ: number
  radius: number
  height: number
  windAngle: number
  intensity: number
}

// grabs the first idle line; a full pool drops the spawn (backpressure, no queue)
export function spawnWindLine(lines: WindLineInstance[], ctx: WindLineSpawnContext, random: () => number = Math.random) {
  const line = lines.find(l => !l.active)
  if (!line) return false

  // strong wind → fast streaks
  line.duration = remapClamp(ctx.intensity, 0, 1, 8, 2)
  line.elapsed = 0
  line.angle = ctx.windAngle
  line.startX = ctx.originX + (random() * 2 - 1) * ctx.radius
  line.startZ = ctx.originZ + (random() * 2 - 1) * ctx.radius
  line.mesh.position.set(line.startX, ctx.height, line.startZ)
  line.mesh.rotation.y = ctx.windAngle
  line.progress.value = 0
  line.mesh.visible = true
  line.active = true
  return true
}

export function updateWindLines(lines: WindLineInstance[], delta: number, translation: number) {
  for (const line of lines) {
    if (!line.active) continue
    line.elapsed += delta
    const t = Math.min(1, line.elapsed / line.duration)
    line.progress.value = t
    line.mesh.position.x = line.startX + Math.sin(line.angle) * translation * t
    line.mesh.position.z = line.startZ + Math.cos(line.angle) * translation * t
    if (t >= 1) {
      line.active = false
      line.mesh.visible = false // zero thickness already hides it; this skips the draw call
    }
  }
}
