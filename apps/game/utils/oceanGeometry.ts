import { BufferGeometry, Float32BufferAttribute } from 'three'

export interface OceanGeometryOptions {
  /** metres between the rings near the centre: the finest detail */
  minStep: number
  /** metres from the centre past which the sea is flat, so one ring spans the rest */
  detailRadius: number
  /** metres from the centre to the last ring */
  radius: number
  /** vertices on each ring */
  segments: number
}

export function ringRadii({ minStep, detailRadius, radius, segments }: OceanGeometryOptions) {
  const radii: number[] = []
  let r = 0
  while (r < detailRadius) {
    // the second term keeps each quad about as deep as it is wide
    r += Math.max(minStep, (r * 2 * Math.PI) / segments)
    radii.push(Math.min(r, detailRadius))
  }
  // No lift out here, and every fragment input is linear on a flat triangle, so one band is exact
  radii.push(radius)
  return radii
}

export function createOceanGeometry(options: OceanGeometryOptions) {
  const { segments } = options
  const radii = ringRadii(options)

  // vertex 0 is the centre, then one block of `segments` vertices per ring
  const positions = new Float32Array((1 + radii.length * segments) * 3)
  radii.forEach((r, ring) => {
    for (let s = 0; s < segments; s++) {
      const angle = (s / segments) * Math.PI * 2
      const i = (1 + ring * segments + s) * 3
      positions[i] = Math.cos(angle) * r
      positions[i + 2] = Math.sin(angle) * r
    }
  })

  // the modulo closes each ring: the last segment joins back to the first
  const at = (ring: number, s: number) => 1 + ring * segments + (s % segments)

  const indices: number[] = []
  for (let s = 0; s < segments; s++) {
    indices.push(0, at(0, s + 1), at(0, s))
  }
  for (let ring = 0; ring < radii.length - 1; ring++) {
    for (let s = 0; s < segments; s++) {
      const inner = at(ring, s)
      const innerNext = at(ring, s + 1)
      const outer = at(ring + 1, s)
      const outerNext = at(ring + 1, s + 1)
      indices.push(inner, innerNext, outer, innerNext, outerNext, outer)
    }
  }

  const normals = new Float32Array(positions.length)
  for (let i = 1; i < normals.length; i += 3) normals[i] = 1

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3))
  geometry.setIndex(indices)
  return geometry
}