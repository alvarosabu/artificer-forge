// three's DepthOfFieldNode (r183) has no resolution option. Only the composite must
// stay full-res (it reads the sharp beauty back); _invSize stays in full-res pixels
// so the bokeh size on screen does not change with the scale.
import DepthOfFieldNode from 'three/addons/tsl/display/DepthOfFieldNode.js'
import { nodeObject } from 'three/tsl'
import type { Node } from 'three/webgpu'

// private fields of DepthOfFieldNode that setSize below resizes by hand (three r183)
const PRIVATE_FIELDS = ['_invSize', '_compositeRT', '_CoCRT', '_CoCBlurredRT', '_blur64RT', '_blur16NearRT', '_blur16FarRT'] as const

export class ScaledDepthOfFieldNode extends DepthOfFieldNode {
  resolutionScale: number

  constructor(
    textureNode: Node,
    viewZNode: Node,
    focusDistanceNode: Node,
    focalLengthNode: Node,
    bokehScaleNode: Node,
    resolutionScale = 0.5,
  ) {
    super(textureNode as any, viewZNode as any, focusDistanceNode as any, focalLengthNode as any, bokehScaleNode as any)
    this.resolutionScale = resolutionScale
    for (const key of PRIVATE_FIELDS) {
      if (!(key in this)) throw new Error(`[ScaledDepthOfFieldNode] DepthOfFieldNode.${key} is missing; the three version is not the one this override was written against`)
    }
  }

  setSize(width: number, height: number): void {
    const self = this as any
    self._invSize.value.set(1 / width, 1 / height)
    self._compositeRT.setSize(width, height)

    const w = Math.max(1, Math.round(width * this.resolutionScale))
    const h = Math.max(1, Math.round(height * this.resolutionScale))
    self._CoCRT.setSize(w, h)
    self._CoCBlurredRT.setSize(w, h)
    self._blur64RT.setSize(w, h)
    self._blur16NearRT.setSize(w, h)
    self._blur16FarRT.setSize(w, h)
  }
}

export const scaledDof = (
  node: Node,
  viewZNode: Node,
  focusDistance: Node,
  focalLength: Node,
  bokehScale: Node,
  resolutionScale?: number,
): ScaledDepthOfFieldNode => new ScaledDepthOfFieldNode(
  nodeObject(node) as unknown as Node,
  nodeObject(viewZNode) as unknown as Node,
  nodeObject(focusDistance) as unknown as Node,
  nodeObject(focalLength) as unknown as Node,
  nodeObject(bokehScale) as unknown as Node,
  resolutionScale,
)
