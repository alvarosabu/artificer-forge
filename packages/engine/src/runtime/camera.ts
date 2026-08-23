// Per-scene camera override forwarded from <Game> to the default CameraController.
// Shared so the host (Game.vue), the controller, and app-level wrappers agree on
// one shape instead of redeclaring it.
export interface CameraControllerProps {
  position?: [number, number, number]
  lookAt?: [number, number, number]
  target?: [number, number, number]
  near?: number
  far?: number
  controls?: boolean
  fov?: number
  maxPolarAngle?: number
  minPolarAngle?: number
  maxDistance?: number
  minDistance?: number
  distance?: number
  up?: [number, number, number]
  follow?: boolean | string
  followHeight?: number
  followSmoothing?: number
}

// Public alias used by <Game> and app-level wrappers.
export type CameraProps = CameraControllerProps

type CameraDefaults = Required<Pick<
  CameraControllerProps,
  'position' | 'near' | 'far' | 'controls' | 'fov' | 'maxPolarAngle' | 'minPolarAngle'
  | 'maxDistance' | 'minDistance' | 'follow' | 'followHeight' | 'followSmoothing'
>>

// The controller's fallbacks live here rather than only in withDefaults() so a
// debug GUI can seed its sliders from the same numbers instead of a second copy
// that drifts.
export const CAMERA_DEFAULTS: CameraDefaults = {
  position: [12.86, 12.57, 15.52],
  near: 0.1,
  far: 1000,
  controls: true,
  fov: 40,
  maxPolarAngle: Math.PI / 2,
  minPolarAngle: Math.PI / 2,
  maxDistance: 100,
  minDistance: 0.1,
  follow: false,
  followHeight: 1.2,
  followSmoothing: 6,
}
