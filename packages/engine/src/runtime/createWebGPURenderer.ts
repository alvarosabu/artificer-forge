import { toValue } from 'vue'
import type { TresRendererSetupContext } from '@tresjs/core'
import { WebGPURenderer } from 'three/webgpu'

// WebGPU renderer is engine policy — EVERY engine canvas (game world, inventory
// preview, portrait studio) must use it. Mixing WebGPU and WebGL canvases is not
// supported: three's WebGPU backend converts non-normalized Uint8/Uint16 buffer
// attributes (glTF skinIndex) to Uint32Array IN PLACE, and geometries are shared
// across canvases via the GLTF caches — a WebGL canvas then binds them as integer
// attributes against float shader inputs and silently drops every skinned mesh.
//
// `alpha` is deliberately NOT on by default. It configures the canvas context as
// `premultiplied`, which gives the PAGE background a say in every pixel whose shader
// writes alpha < 1: one material leaking a cutout alpha (see stylizedOutput's
// alphaTest path) and the DOM bleeds through the scene as a bright rim. TresCanvas's
// own `:alpha` prop does not reach here — a custom renderer factory builds the
// renderer itself — so transparency is a choice made by picking a factory below.

/** Opaque canvas. The default, and what every world scene should use. */
export function createWebGPURenderer(ctx: TresRendererSetupContext) {
  return new WebGPURenderer({
    canvas: toValue(ctx.canvas),
    antialias: true,
  })
}

/**
 * Transparent canvas, for the canvases whose OUTPUT is meant to composite over the
 * page: portrait bakes (no background layer = transparent PNG) and the inventory
 * preview (its panel tint shows through). Never for a world scene.
 */
export function createTransparentWebGPURenderer(ctx: TresRendererSetupContext) {
  return new WebGPURenderer({
    canvas: toValue(ctx.canvas),
    alpha: true,
    antialias: true,
  })
}
