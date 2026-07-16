import { CanvasTexture, ClampToEdgeWrapping, Vector2 } from 'three'
import { uniform } from 'three/tsl'
import type { Node, UniformNode } from 'three/webgpu'

export interface TrampleSettings {
  /** world extent covered by the map (width = depth), centered on origin */
  size?: number
  /** texels per side */
  resolution?: number
  /** trample fraction removed per second (spring-back speed) */
  recovery?: number
  /** default stamp radius in world units */
  stampRadius?: number
}

export interface TrampleUniforms {
  origin: UniformNode<'vec2', Vector2>
  size: UniformNode<'float', number>
  interactor: UniformNode<'vec2', Vector2>
  interactorRadius: UniformNode<'float', number>
}

export interface TrampleMap {
  texture: CanvasTexture
  uniforms: TrampleUniforms
  stamp: (x: number, z: number, strength?: number, radius?: number) => void
  setInteractor: (x: number, z: number) => void
  setOrigin: (x: number, z: number) => void
  update: (delta: number) => void
  dispose: () => void
}

// shader-side world XZ → map UV, mirrors the CPU mapping in worldToPixel
export function trampleUv(uniforms: TrampleUniforms, worldXZ: Node<'vec2'>) {
  return worldXZ.sub(uniforms.origin).div(uniforms.size).add(0.5)
}

// CanvasTexture flips Y (v=1 at canvas row 0), so +z maps to decreasing pixel y
export function worldToPixel(x: number, z: number, originX: number, originZ: number, size: number, resolution: number) {
  const u = (x - originX) / size + 0.5
  const v = (z - originZ) / size + 0.5
  return { x: u * resolution, y: (1 - v) * resolution }
}

// fades below this alpha stall on 8-bit rounding, so accumulate until it's worth applying.
// Multiplicative fade leaves a ~5% residual in old trails — invisible under wind sway.
const MIN_FADE_ALPHA = 6 / 255

export function createTrampleMap(settings: TrampleSettings = {}): TrampleMap {
  const { size = 30, resolution = 256, recovery = 0.4, stampRadius = 0.9 } = settings

  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = resolution
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('[trample] 2d canvas context unavailable')
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, resolution, resolution)

  const texture = new CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = ClampToEdgeWrapping

  const uniforms: TrampleUniforms = {
    origin: uniform(new Vector2(0, 0)),
    size: uniform(size),
    // parked far away = inactive until the first setInteractor call
    interactor: uniform(new Vector2(1e6, 1e6)),
    interactorRadius: uniform(1.2),
  }

  const pxPerUnit = resolution / size
  let fadeCarry = 0

  function stamp(x: number, z: number, strength = 1, radius = stampRadius) {
    const p = worldToPixel(x, z, uniforms.origin.value.x, uniforms.origin.value.y, uniforms.size.value, resolution)
    const r = radius * pxPerUnit
    const gradient = ctx!.createRadialGradient(p.x, p.y, 0, p.x, p.y, r)
    gradient.addColorStop(0, `rgba(255,255,255,${strength})`)
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    ctx!.fillStyle = gradient
    ctx!.fillRect(p.x - r, p.y - r, r * 2, r * 2)
    texture.needsUpdate = true
  }

  function update(delta: number) {
    fadeCarry += recovery * delta
    if (fadeCarry < MIN_FADE_ALPHA) return
    ctx!.fillStyle = `rgba(0, 0, 0, ${Math.min(1, fadeCarry)})`
    ctx!.fillRect(0, 0, resolution, resolution)
    fadeCarry = 0
    texture.needsUpdate = true
  }

  return {
    texture,
    uniforms,
    stamp,
    update,
    setInteractor: (x, z) => uniforms.interactor.value.set(x, z),
    setOrigin: (x, z) => uniforms.origin.value.set(x, z),
    dispose: () => texture.dispose(),
  }
}
