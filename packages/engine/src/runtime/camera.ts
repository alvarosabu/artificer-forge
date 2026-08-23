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
