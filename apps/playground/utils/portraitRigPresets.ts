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

// ─── Portrait camera tuning ──────────────────────────────────────────────────
// Tweak these to reframe ALL portraits. Values are fractions of the model's
// height, so they hold across any model scale. Changes apply on next bake —
// during dev, also bump PORTRAIT_CACHE_VERSION in portraitSignature.ts (or clear
// localStorage 'af:portraits') so cached portraits re-bake.
const PORTRAIT_CAMERA = {
  // How far below the model's top to aim, as a fraction of height.
  // Smaller = look higher (toward crown); larger = look lower (more chest).
  anchorFromTop: 0.14,
  // Vertical slice of the model to fit in frame, as a fraction of height.
  // Smaller = tighter/bigger head; larger = zoomed out / more body.
  viewHeightFraction: 0.42,
  // Field of view (deg). Lower = flatter, more telephoto look.
  fov: 30,
  // Camera height offset relative to the look point (units). Positive = look
  // down on the subject slightly; negative = look up.
  cameraHeightOffset: 0,
}
// ─────────────────────────────────────────────────────────────────────────────

// Auto-frame a head/bust portrait from the subject's world-space bounding box.
// Robust to any model scale/height (these character rigs are ~4.4 units tall),
// so it works for arbitrary / custom characters without per-rig tuning.
// Assumes the model faces +Z (Three/GLB convention) — camera is placed in front.
export function frameFromBounds(min: Vec3, max: Vec3, fov = PORTRAIT_CAMERA.fov): PortraitFraming {
  const sizeY = max[1] - min[1]
  const centerX = (min[0] + max[0]) / 2
  const centerZ = (min[2] + max[2]) / 2

  const anchorY = max[1] - sizeY * PORTRAIT_CAMERA.anchorFromTop
  const viewHeight = sizeY * PORTRAIT_CAMERA.viewHeightFraction
  const dist = (viewHeight / 2) / Math.tan((fov * Math.PI) / 360)

  return {
    cameraPosition: [centerX, anchorY + PORTRAIT_CAMERA.cameraHeightOffset, max[2] + dist],
    lookAt: [centerX, anchorY, centerZ],
    fov,
  }
}
