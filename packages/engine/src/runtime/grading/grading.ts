import { Color, Vector2, Vector3 } from 'three'
import { mix, rangeFogFactor, uniform, viewportUV } from 'three/tsl'

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

export interface GradingContextOptions {
  /** distance where fog ratio 0 lands (roughly camera → scene center) */
  sceneNear: number
  /** distance where fog ratio 1 lands (scene far edge) */
  sceneFar: number
}

/**
 * TSL bridge for GradingProps: one uniform per prop plus derived fog nodes.
 * fogColor doubles as the scene background — that's what makes distant
 * geometry dissolve into the sky with no horizon seam.
 */
export function createGradingContext(options: GradingContextOptions) {
  // mutable so the scene distance range can be tuned live (sync reads it each frame)
  const range = { sceneNear: options.sceneNear, sceneFar: options.sceneFar }

  const uniforms = {
      lightDirection: uniform(new Vector3(-1, -1, -1).normalize()),
      lightColor: uniform(new Color('#ffffff')),
      lightIntensity: uniform(1),
      shadowColor: uniform(new Color('#000000')),
      fogColorA: uniform(new Color('#88aaff')),
      fogColorB: uniform(new Color('#4455aa')),
      fogNear: uniform(range.sceneNear),
      fogFar: uniform(range.sceneFar),
      // screen-space gradient shape (tweak for taste, not per-preset)
      radialCenter: uniform(new Vector2(0.5, 0.5)),
      radialStart: uniform(0),
      radialEnd: uniform(1),
      // core shadow ramp (stylizedOutput reads these) — tight band = visible cel step
      shadowEdgeLow: uniform(0),
      shadowEdgeHigh: uniform(0.25),
      // mid-tone zone (stylizedOutput's hasMidTone): sits between lit and core shadow
      midEdgeLow: uniform(-0.35),
      midEdgeHigh: uniform(-0.15),
      // how far the mid tone leans toward the shadow color (0 = lit, 1 = shadow)
      midStrength: uniform(0.5),
      // 0 = smooth band (current look), 1 = hard step() at the band center (Wind Waker cel)
      rampHardness: uniform(0),
      // rim light (stylizedOutput's hasRim): fresnel edge glow tinted by lightColor
      rimStrength: uniform(0.25),
      rimPower: uniform(3),
      // stepped toon specular (stylizedOutput's hasSpecular) — strength 0 by default:
      // without gloss masks the highlight hits skin/cloth too and reads plastic
      specStrength: uniform(0),
      specShininess: uniform(32),
  }

  const dist = viewportUV.sub(uniforms.radialCenter).length()
  const fogColor = mix(
      uniforms.fogColorA,
      uniforms.fogColorB,
      dist.smoothstep(uniforms.radialStart, uniforms.radialEnd),
  )
  const fogStrength = rangeFogFactor(uniforms.fogNear, uniforms.fogFar)

  function sync(props: GradingProps) {
      uniforms.lightDirection.value.copy(props.lightDirection)
      uniforms.lightColor.value.copy(props.lightColor)
      uniforms.lightIntensity.value = props.lightIntensity
      uniforms.shadowColor.value.copy(props.shadowColor)
      uniforms.fogColorA.value.copy(props.fogColorA)
      uniforms.fogColorB.value.copy(props.fogColorB)
      const span = range.sceneFar - range.sceneNear
      uniforms.fogNear.value = range.sceneNear + props.fogNearRatio * span
      uniforms.fogFar.value = range.sceneNear + props.fogFarRatio * span
  }

  return { uniforms, fogColor, fogStrength, sync, range }
}

export type GradingContext = ReturnType<typeof createGradingContext>