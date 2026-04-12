import { color as colorNode, dot, float, mix, mx_fractal_noise_float, normalView, positionLocal, positionViewDirection, pow, smoothstep, sub, time, uniform, vec3 } from 'three/tsl'
import { DoubleSide, MeshPhysicalNodeMaterial } from 'three/webgpu'

export interface GhostMaterialOptions {
  color?: string,
  glowStrength?: number,
  fresnelPower?: number,
  noiseScale?: number,
  noiseSpeed?: number,
  noiseIntensity?: number,
}

export function ghostMaterial({
  color = '#88ccff',
  glowStrength = 12.0,
  fresnelPower = 1.5,
  noiseScale = 1.5,
  noiseSpeed = 0.3,
  noiseIntensity = 0.5,
}) {
  const uniforms = {
    color: uniform(colorNode(color)),
    glowStrength: uniform(float(glowStrength)),
    fresnelPower: uniform(float(fresnelPower)),
    noiseScale: uniform(float(noiseScale)),
    noiseSpeed: uniform(float(noiseSpeed)),
    noiseIntensity: uniform(float(noiseIntensity)),
  }
  // Fresnel: edges bright, core dark — matching Blender Layer Weight Fresnel
  const NdotV = dot(normalView, positionViewDirection).abs()
  const fresnelFactor = pow(sub(float(1.0), NdotV), uniforms.fresnelPower).mul(0.9)

  // S-curve shaping (approximates the RGB Curves node)
  const shaped = smoothstep(float(0.0), float(1.0), fresnelFactor)

  // Ethereal noise
  const animatedPos = positionLocal.add(time.mul(uniforms.noiseSpeed))
  const noiseValue = mx_fractal_noise_float(animatedPos.mul(uniforms.noiseScale), 3, 2, 0.5)
  const noiseFactor = mix(float(1.0), noiseValue.remapClamp(float(-1), float(1), float(0), float(1)), uniforms.noiseIntensity)
  const shapedWithNoise = shaped.mul(noiseFactor)

  const material = new MeshPhysicalNodeMaterial()
  material.transparent = true
  material.depthWrite = false
  material.side = DoubleSide
  material.colorNode = vec3(0, 0, 0)
  material.opacityNode = shapedWithNoise
  material.emissiveNode = uniforms.color.mul(shapedWithNoise).mul(uniforms.glowStrength)

  return {
    material,
    uniforms,
  }
}
