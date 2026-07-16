import { Color, Vector3 } from 'three'

export interface GradingProps {
  /** normalized, pointing FROM the light into the scene (same convention as foliage's old lightingDirection) */
  lightDirection: Vector3
  lightColor: Color
  lightIntensity: number
  shadowColor: Color
  /** gradient center (horizon) */
  fogColorA: Color
  /** gradient edge (zenith) */
  fogColorB: Color
  /** -2..2, ratio of the scene view distance; negative = fog starts behind the camera */
  fogNearRatio: number
  fogFarRatio: number
}
