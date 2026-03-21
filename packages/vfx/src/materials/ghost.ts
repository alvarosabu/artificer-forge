import { color, dot, float, normalView, positionViewDirection, pow, smoothstep, sub, vec3 } from 'three/tsl'
import { DoubleSide, MeshPhysicalNodeMaterial } from 'three/webgpu'

export function ghostMaterial() {
  // Fresnel: edges bright, core dark — matching Blender Layer Weight Fresnel
  const NdotV = dot(normalView, positionViewDirection).abs()
  const fresnelFactor = pow(sub(float(1.0), NdotV), float(1.5)).mul(0.9)

  // S-curve shaping (approximates the RGB Curves node)
  const shaped = smoothstep(float(0.0), float(1.0), fresnelFactor)

  const material = new MeshPhysicalNodeMaterial()
  material.transparent = true
  material.depthWrite = false
  material.side = DoubleSide
  material.colorNode = vec3(0, 0, 0)
  material.opacityNode = shaped
  material.emissiveNode = color('#88ccff').mul(shaped).mul(12.0)
  return material
}
