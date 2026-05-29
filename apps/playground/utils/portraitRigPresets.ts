import type { RigSize } from '@artificer-forge/composables'

export interface PortraitFraming {
  cameraPosition: [number, number, number]
  lookAt: [number, number, number]
  fov: number
}

// Head/bust framing per rig type. Tuned by eye later.
export const PORTRAIT_FRAMING: Record<RigSize, PortraitFraming> = {
  Medium: { cameraPosition: [0, 1.62, 1.15], lookAt: [0, 1.5, 0], fov: 28 },
  Large: { cameraPosition: [0, 4.0, 3.2], lookAt: [0, 3.8, -0.3], fov: 30 },
}

export function framingForRig(rig?: string): PortraitFraming {
  const size = (rig?.replace('Rig_', '') ?? 'Medium') as RigSize
  return PORTRAIT_FRAMING[size] ?? PORTRAIT_FRAMING.Medium
}

export type Vec3 = [number, number, number]

// Auto-frame a head/bust portrait from the subject's world-space bounding box.
// Robust to any model scale/height (these character rigs are ~4.4 units tall),
// so it works for arbitrary / custom characters without per-rig tuning.
// Assumes the model faces +Z (Three/GLB convention) — camera is placed in front.
export function frameFromBounds(min: Vec3, max: Vec3, fov = 30): PortraitFraming {
  const sizeY = max[1] - min[1]
  const centerX = (min[0] + max[0]) / 2
  const centerZ = (min[2] + max[2]) / 2

  // Anchor slightly below the very top so ears/hair don't crowd the frame edge.
  const anchorY = max[1] - sizeY * 0.14
  // Vertical extent to show: head + a little chest.
  const viewHeight = sizeY * 0.42
  const dist = (viewHeight / 2) / Math.tan((fov * Math.PI) / 360)

  return {
    cameraPosition: [centerX, anchorY, max[2] + dist],
    lookAt: [centerX, anchorY, centerZ],
    fov,
  }
}
