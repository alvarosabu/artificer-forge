// three's BloomNode re-reads the drawing-buffer size every frame and always
// builds its mip chain from half of it, with no resolution option (r183). The
// only hook is setSize, so this subclass scales the incoming size first.
// resolutionScale = 1 is stock three (half-res chain); 0.5 starts the chain at
// quarter res, ~4x fewer blurred pixels. Bloom is a blur, so the lower base
// resolution does not show in the final image.
import BloomNode from 'three/addons/tsl/display/BloomNode.js'
import { nodeObject } from 'three/tsl'
import type { Node } from 'three/webgpu'

export class ScaledBloomNode extends BloomNode {
  resolutionScale: number

  constructor(inputNode: Node, strength?: number, radius?: number, threshold?: number, resolutionScale = 0.5) {
    super(inputNode, strength, radius, threshold)
    this.resolutionScale = resolutionScale
  }

  setSize(width: number, height: number): void {
    super.setSize(
      Math.max(1, Math.round(width * this.resolutionScale)),
      Math.max(1, Math.round(height * this.resolutionScale)),
    )
  }
}

export const scaledBloom = (
  node: Node,
  strength?: number,
  radius?: number,
  threshold?: number,
  resolutionScale?: number,
): ScaledBloomNode => new ScaledBloomNode(nodeObject(node) as unknown as Node, strength, radius, threshold, resolutionScale)
