// three's DepthOfFieldNode (r183) runs its CoC pass at full resolution and the
// four bokeh passes at a fixed half resolution, re-sizing from the input texture
// every frame. The two 64-tap bokeh passes are the bulk of the cost, and the
// only pass that has to stay full-res is the composite (it reads the sharp
// beauty back). This subclass scales everything else. resolutionScale = 0.5 is
// close to stock (CoC drops to half-res too), 0.25 runs the blur at quarter res
// for ~4x fewer bokeh taps. The tap spacing stays in full-res pixels via
// _invSize, so the bokeh size on screen does not change with the scale.
import DepthOfFieldNode from 'three/addons/tsl/display/DepthOfFieldNode.js'
import { nodeObject } from 'three/tsl'
import type { Node } from 'three/webgpu'

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
