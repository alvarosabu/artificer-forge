// Miniature/diorama effect (Expedition 33 overworld style): blur driven by
// screen-space distance from a horizontal focus band, not by scene depth.
// Unlike ScaledDepthOfFieldNode this needs no subclass: GaussianBlurNode takes a
// per-fragment radius (directionNode) and has a resolutionScale option since r180.
import GaussianBlurNode, { gaussianBlur } from 'three/addons/tsl/display/GaussianBlurNode.js'
import { mix, smoothstep, screenUV } from 'three/tsl'
import type { Node, TextureNode } from 'three/webgpu'

export interface TiltShiftNodes {
  /** Screen height of the sharp line, 0 = bottom, 1 = top. */
  focusCenter: Node<'float'>
  /** Half-height of the fully sharp band, in screen fractions. */
  bandWidth: Node<'float'>
  /** Ramp length from sharp to fully blurred, in screen fractions. */
  feather: Node<'float'>
  /** Blur radius multiplier. Stretches the kernel's reach, not its tap count. */
  strength: Node<'float'>
  /** Focus depth along the camera axis (same smoothed value the DOF pass tracks). */
  focusDistance: Node<'float'>
  /** Depth band (world units) around the focus depth that stays sharp inside the ramp. */
  focalRange: Node<'float'>
}

export interface TiltShiftOptions {
  /** Kernel taps = 3 + 2·sigma. Baked into the shader, so changing it needs a pipeline rebuild. */
  sigma?: number
  /** Scale of the two blur passes. The sharp band never pays for it: the composite reads the full-res scene. */
  resolutionScale?: number
}

export interface TiltShiftResult {
  /** The composited node to splice into the pipeline. */
  node: Node<'vec4'>
  /** The inner blur, exposed so resolutionScale can be changed live. */
  blur: GaussianBlurNode
}

export function tiltShift(colorNode: TextureNode, viewZNode: Node<'float'>, nodes: TiltShiftNodes, options: TiltShiftOptions = {}): TiltShiftResult {
  const { sigma = 8, resolutionScale = 0.5 } = options

  // screenUV's origin is top-left (WebGPU convention), focusCenter counts from the bottom.
  const screenDist = screenUV.y.sub(nodes.focusCenter.oneMinus()).abs()
  const screenMask = smoothstep(nodes.bandWidth, nodes.bandWidth.add(nodes.feather), screenDist)

  // A fragment near the focus depth stays sharp even where it crosses out of the
  // band (a tall tree above the character), so the mask is screen x depth.
  const depthDist = viewZNode.negate().sub(nodes.focusDistance).abs()
  const depthMask = smoothstep(0, nodes.focalRange, depthDist)

  const mask = screenMask.mul(depthMask)

  // The mask also scales the blur radius per fragment, so the falloff is graduated
  // instead of a hard sharp/blurred seam at the band edge.
  const blur = gaussianBlur(colorNode, mask.mul(nodes.strength), sigma, { resolutionScale })

  // Blur coefficients only sum to ~1 and the blur RTs are scaled, so the band must
  // read the untouched scene rather than pass through the blur at radius 0.
  const node = mix(colorNode, blur, mask)

  return { node, blur }
}
