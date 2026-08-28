// three's BloomNode (r183) has no resolution option and re-reads the drawing-buffer
// size every frame; setSize is the only hook, so the incoming size is scaled here.
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
