import { Color, Vector2, Vector3, Vector4 } from 'three'
import { mix, rangeFogFactor, uniform, uniformArray, viewportUV } from 'three/tsl'

export const MAX_POINT_LIGHTS = 16

/** A warm pool the grading adds around a source such as a torch. Graded materials ignore Three lights. */
export interface PointLight {
  position: Vector3
  /** distance where the pool fades to zero */
  radius: number
  color: Color
  intensity: number
  /** 0 = steady, 1 = the pool pulses between dark and twice its intensity */
  flicker: number
}

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
  /** time-of-day scale on every point light, e.g. 0 at noon and 1 at night. Defaults to 1 */
  pointLightIntensity?: number
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
      // fake AO (stylizedOutput's aoNode): global scale for how far occlusion
      // pushes into the shadow band — 0 disables AO everywhere
      aoStrength: uniform(1),
      // stepped toon specular (stylizedOutput's hasSpecular) — strength 0 by default:
      // without gloss masks the highlight hits skin/cloth too and reads plastic
      specStrength: uniform(0),
      specShininess: uniform(32),
      // xyz = position, w = radius
      pointLights: uniformArray(Array.from({ length: MAX_POINT_LIGHTS }, () => new Vector4()), 'vec4'),
      // rgb = color × intensity, w = flicker
      pointLightColors: uniformArray(Array.from({ length: MAX_POINT_LIGHTS }, () => new Vector4()), 'vec4'),
      pointLightCount: uniform(0, 'int'),
      pointLightIntensity: uniform(1),
  }

  const pointLightGroups = new Set<PointLight[]>()

  /** Rewrites the point light buffers. Call after mutating a registered light. */
  function updatePointLights() {
      const positions = uniforms.pointLights.array as Vector4[]
      const colors = uniforms.pointLightColors.array as Vector4[]
      let count = 0
      for (const group of pointLightGroups) {
          for (const light of group) {
              if (count === MAX_POINT_LIGHTS) break
              const { position, color, intensity } = light
              positions[count]!.set(position.x, position.y, position.z, light.radius)
              colors[count]!.set(color.r * intensity, color.g * intensity, color.b * intensity, light.flicker)
              count++
          }
      }
      uniforms.pointLightCount.value = count
  }

  /** Registers lights for every graded material. Returns the function that removes them. */
  function addPointLights(lights: PointLight[]) {
      pointLightGroups.add(lights)
      const total = [...pointLightGroups].reduce((sum, group) => sum + group.length, 0)
      if (total > MAX_POINT_LIGHTS) console.warn(`[grading] ${total} point lights, only the first ${MAX_POINT_LIGHTS} are drawn`)
      updatePointLights()
      return () => {
          pointLightGroups.delete(lights)
          updatePointLights()
      }
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
      uniforms.pointLightIntensity.value = props.pointLightIntensity ?? 1
  }

  return { uniforms, fogColor, fogStrength, sync, range, addPointLights, updatePointLights }
}

export type GradingContext = ReturnType<typeof createGradingContext>