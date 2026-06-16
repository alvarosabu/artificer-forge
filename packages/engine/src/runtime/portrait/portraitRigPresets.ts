export interface PortraitFraming {
  cameraPosition: [number, number, number]
  lookAt: [number, number, number]
  fov: number
}

export type Vec3 = [number, number, number]

// ─── Portrait camera tuning ──────────────────────────────────────────────────
// Portraits are framed off the rig's HEAD MESH box (its world-space centre +
// height), NOT the whole-model bounding box. The head mesh is the same regardless
// of body, equipment, capes or pose, so framing is consistent across characters —
// and, crucially, it scales to the ACTUAL head size. (Scaling by the head-BONE
// height instead overshoots tall rigs: a werewolf's head bone sits high on long
// legs, but its head isn't proportionally bigger, so it framed zoomed-out/low.)
//
// Offsets are fractions of the head height, so the same knobs hold across rig
// sizes (Medium head ≈ 1.0, Large ≈ 1.5). Tweak these to reframe ALL portraits.
// Changes apply on next bake — clear localStorage 'af:portraits' (or re-enable +
// bump PORTRAIT_CACHE_VERSION in portraitSignature.ts) so cached portraits rebake.
export const PORTRAIT_CAMERA = {
  // Shift the look point above (+) or below (−) the head-box centre, as a
  // fraction of head height. 0 = dead-centre on the head.
  headLift: 0,
  // Vertical slice to fit in frame, as a multiple of head height. ~1 = head fills
  // the frame; larger = more headroom + shoulders.
  viewHeight: 1.3,
  // Field of view (deg). Lower = flatter, more telephoto look.
  fov: 30,
  // Camera height offset relative to the look point, as a fraction of head height.
  // Positive = look down on the subject slightly; negative = look up.
  cameraHeightOffset: 0.05,
  // Horizontal orbit angle (deg) around the head, keeping the framing distance.
  // 0 = dead front; positive swings the camera to the model's left for a 3/4 view.
  yaw: 20,
}
// ─────────────────────────────────────────────────────────────────────────────

export type FrameOptions = Partial<typeof PORTRAIT_CAMERA>

// Frame a head/bust portrait from the head mesh's world box.
// `center` is the head box centre; `headHeight` is its world-space height, used to
// size every offset so the same knobs work for any rig/creature. Assumes the model
// faces +Z (Three/GLB convention) — the camera is placed in front. Pass `opts` to
// override PORTRAIT_CAMERA (used by the portrait lab).
export function frameFromHead(center: Vec3, headHeight: number, opts: FrameOptions = {}): PortraitFraming {
  const fov = opts.fov ?? PORTRAIT_CAMERA.fov
  const headLift = opts.headLift ?? PORTRAIT_CAMERA.headLift
  const viewHeight = opts.viewHeight ?? PORTRAIT_CAMERA.viewHeight
  const cameraHeightOffset = opts.cameraHeightOffset ?? PORTRAIT_CAMERA.cameraHeightOffset
  const yaw = opts.yaw ?? PORTRAIT_CAMERA.yaw

  const anchorY = center[1] + headLift * headHeight
  const viewSpan = viewHeight * headHeight
  const dist = (viewSpan / 2) / Math.tan((fov * Math.PI) / 360)
  const yawRad = (yaw * Math.PI) / 180

  // Orbit the camera horizontally around the head anchor at the framing distance,
  // placed in front of the face (+Z). yaw 0 keeps the dead-front placement.
  return {
    cameraPosition: [
      center[0] + dist * Math.sin(yawRad),
      anchorY + cameraHeightOffset * headHeight,
      center[2] + dist * Math.cos(yawRad),
    ],
    lookAt: [center[0], anchorY, center[2]],
    fov,
  }
}
