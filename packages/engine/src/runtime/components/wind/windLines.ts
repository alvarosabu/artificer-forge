import { BufferAttribute, BufferGeometry, CatmullRomCurve3, Vector3 } from 'three'

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
