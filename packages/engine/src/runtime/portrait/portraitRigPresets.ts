import { ACESFilmicToneMapping } from 'three'

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
  headLift: 0,
  viewHeight: 1.4,
  fov: 10,
  cameraHeightOffset: 0.05,
  yaw: 20,
}
// ─────────────────────────────────────────────────────────────────────────────

// Renderer state for portrait canvases (bake studio AND the lab previews — they
// must stay identical or the lab stops being WYSIWYG). ACES filmic is the
// punchiest transform three ships (three's AgX is the look-less base curve —
// flat and desaturated, NOT Blender's contrasty AgX) and gets closest to the
// authored Blender reference portraits.
// NOTE: pass these EXPLICITLY to every portrait <TresCanvas> — an omitted
// tone-mapping prop silently falls back to TresJS's default.
export const PORTRAIT_RENDERING = {
  toneMapping: ACESFilmicToneMapping,
  toneMappingExposure: 1.1,
  shadows: true,
  /** Backdrop-driven scene.environment strength (Blender-GI-like bounce). */
  environmentIntensity: 0.1,
}

// Portrait lighting (positions live in <PortraitLights>). Warm key dominates;
// everything cool (fill, rim, backdrop bounce) stays subtle so portraits read
// warm + dramatic, not blue. Tune live in the portrait lab panel.
// Warmth gotcha: under ACES an overexposed warm light bleaches to WHITE — for a
// warmer face, deepen keyColor toward orange and/or lower key/exposure; cranking
// key intensity makes it colder.
export const PORTRAIT_LIGHTS = {
  key: 2.5,
  keyColor: '#ffd9a3',
  fill: 0.2,
  fillColor: '#9fb8ff',
  rim: 1.8,
  rimColor: '#cfe0ff',
  bounce: 0.35,
  bounceSky: '#eed9bd',
  bounceGround: '#5a4030',
}

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
