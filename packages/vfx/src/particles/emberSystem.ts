import { AdditiveBlending, BufferAttribute, BufferGeometry, Points, PointsMaterial } from 'three'

export const EMBER_COUNT = 60
export const CHAR_HEIGHT = 2.2
export const MAX_RADIUS = 0.55
export const RESET_Y = CHAR_HEIGHT + 0.4 // despawn height

export interface EmberMeta {
  angle: number
  radius: number
  initialY: number
  speed: number
  wobblePhase: number
  wobbleFreq: number
}

export function lerpRgb(
  r0: number, g0: number, b0: number,
  r1: number, g1: number, b1: number,
  t: number,
): [number, number, number] {
  return [r0 + (r1 - r0) * t, g0 + (g1 - g0) * t, b0 + (b1 - b0) * t]
}

export function heatColor(heat: number): [number, number, number] {
  // 0 = deep red  →  0.5 = orange  →  1 = yellow
  const red = [0.73, 0.07, 0.0] as const
  const orange = [1.0, 0.33, 0.0] as const
  const yellow = [1.0, 0.93, 0.27] as const
  if (heat < 0.5) return lerpRgb(...red, ...orange, heat * 2)
  return lerpRgb(...orange, ...yellow, (heat - 0.5) * 2)
}

export function createEmberSystem() {
  const positions = new Float32Array(EMBER_COUNT * 3)
  const colors = new Float32Array(EMBER_COUNT * 3)
  const meta: EmberMeta[] = []

  for (let i = 0; i < EMBER_COUNT; i++) {
    const angle = Math.random() * Math.PI * 2
    const radius = 0.12 + Math.random() * (MAX_RADIUS - 0.12)
    const y = Math.random() * CHAR_HEIGHT // stagger initial heights

    positions[i * 3 + 0] = Math.cos(angle) * radius
    positions[i * 3 + 1] = y
    positions[i * 3 + 2] = Math.sin(angle) * radius

    const [r, g, b] = heatColor(Math.random())
    colors[i * 3 + 0] = r
    colors[i * 3 + 1] = g
    colors[i * 3 + 2] = b

    meta.push({
      angle,
      radius,
      initialY: Math.random() * 0.2,
      speed: 0.5 + Math.random() * 1.0,
      wobblePhase: Math.random() * Math.PI * 2,
      wobbleFreq: 1.2 + Math.random() * 2.5,
    })
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('color', new BufferAttribute(colors, 3))

  const material = new PointsMaterial({
    size: 0.05,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  })

  const points = new Points(geometry, material)
  points.frustumCulled = false

  return { points, geometry, positions, colors, meta }
}
