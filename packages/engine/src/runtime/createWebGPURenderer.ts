import { toValue } from 'vue'
import type { TresRendererSetupContext } from '@tresjs/core'
import { WebGPURenderer } from 'three/webgpu'

// WebGPU renderer is engine policy — EVERY engine canvas (game world, inventory
// preview, portrait studio) must use it. Mixing WebGPU and WebGL canvases is not
// supported: three's WebGPU backend converts non-normalized Uint8/Uint16 buffer
// attributes (glTF skinIndex) to Uint32Array IN PLACE, and geometries are shared
// across canvases via the GLTF caches — a WebGL canvas then binds them as integer
// attributes against float shader inputs and silently drops every skinned mesh.
export function createWebGPURenderer(ctx: TresRendererSetupContext) {
  return new WebGPURenderer({
    canvas: toValue(ctx.canvas),
    alpha: true,
    antialias: true,
  })
}
