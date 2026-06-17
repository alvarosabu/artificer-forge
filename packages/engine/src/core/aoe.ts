// Area-of-effect targeting geometry — pure. Operates on flat {x,z} points so core
// stays Three-free; callers can pass a Three Vector3 (structurally compatible).

export interface Vec2 {
  x: number
  z: number
}

export type TargetEntities = Iterable<[string, { position: Vec2 }]>

/** Ids whose position lies within `radius` of `center` (XZ plane). */
export function entitiesInCircle(center: Vec2, radius: number, entities: TargetEntities): string[] {
  const ids: string[] = []
  for (const [id, e] of entities) {
    const dx = e.position.x - center.x
    const dz = e.position.z - center.z
    if (Math.sqrt(dx * dx + dz * dz) <= radius) ids.push(id)
  }
  return ids
}

/** Ids within `length` of `origin` and inside the cone half-angle around `direction`. */
export function entitiesInCone(
  origin: Vec2,
  direction: Vec2,
  length: number,
  halfAngleDeg: number,
  entities: TargetEntities,
): string[] {
  const halfAngle = halfAngleDeg * (Math.PI / 180)
  const dirLen = Math.sqrt(direction.x * direction.x + direction.z * direction.z) || 1
  const dirX = direction.x / dirLen
  const dirZ = direction.z / dirLen
  const ids: string[] = []

  for (const [id, e] of entities) {
    const dx = e.position.x - origin.x
    const dz = e.position.z - origin.z
    const dist = Math.sqrt(dx * dx + dz * dz)
    if (dist > length || dist === 0) continue

    const vx = dx / dist
    const vz = dz / dist
    const angle = Math.acos(Math.min(1, dirX * vx + dirZ * vz))
    if (angle <= halfAngle) ids.push(id)
  }
  return ids
}

/** Ids within a `halfWidth` band of the segment start→end. */
export function entitiesInLine(start: Vec2, end: Vec2, halfWidth: number, entities: TargetEntities): string[] {
  const dx = end.x - start.x
  const dz = end.z - start.z
  const length = Math.sqrt(dx * dx + dz * dz)
  if (length === 0) return []

  const dirX = dx / length
  const dirZ = dz / length
  const ids: string[] = []

  for (const [id, e] of entities) {
    const px = e.position.x - start.x
    const pz = e.position.z - start.z
    const proj = px * dirX + pz * dirZ
    if (proj < 0 || proj > length) continue
    const perp = Math.abs(px * (-dirZ) + pz * dirX)
    if (perp <= halfWidth) ids.push(id)
  }
  return ids
}
